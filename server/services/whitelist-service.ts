import "server-only";

import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";

import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload } from "@/lib/email/process";
import { ApiError } from "@/lib/errors";
import type { WhitelistEntry } from "@/lib/generated/prisma/client";
import { NotificationType, UserRole, WhitelistStatus } from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmail } from "@/lib/jobs/qstash";
import { isValidEmail, normalizeEmail } from "@/lib/utils/email";

// NFR-2.2: Büyük import'lar kontrollü işlenir.
const MAX_IMPORT_ROWS = 2000;
const CREATE_CHUNK_SIZE = 500;

export type CsvImportResult = {
  totalRows: number;
  created: number;
  duplicates: number;
  invalid: number;
  errors: Array<{ row: number; email: string; reason: string }>;
};

export type ImportSource =
  | { kind: "csv"; content: string }
  | { kind: "xlsx"; buffer: ArrayBuffer };

// Ortak ara satır biçimi: CSV ve XLSX aynı hattan işlenir.
type SpreadsheetRow = { rowNumber: number; email: string; name?: string; role?: string };

function registerUrl(email: string): string {
  return `${appUrl()}/register?email=${encodeURIComponent(email)}`;
}

export async function sendInvitation(entry: WhitelistEntry, jobKey?: string): Promise<void> {
  await enqueueEmail(
    buildEmailPayload({
      jobKey: jobKey ?? jobKeys.invitation(entry.id),
      type: NotificationType.INVITATION,
      to: entry.email,
      data: { name: entry.name, registerUrl: registerUrl(entry.email) },
    }),
  );
  await prisma.whitelistEntry.update({
    where: { id: entry.id },
    data: { invitedAt: new Date() },
  });
}

// FR-2.1 / FR-2.4: manuel ekleme; aynı e-posta ikinci kez eklenmez.
// REVOKED kayıt yeniden PENDING yapılır (yeniden davet).
export async function addWhitelistEntry(params: {
  email: string;
  name?: string | null;
  role: UserRole;
  createdById: string;
}): Promise<WhitelistEntry> {
  const email = normalizeEmail(params.email);
  if (!isValidEmail(email)) {
    throw new ApiError("VALIDATION_ERROR", "Geçersiz e-posta adresi.");
  }

  const existing = await prisma.whitelistEntry.findUnique({ where: { email } });
  if (existing) {
    if (existing.status === WhitelistStatus.REVOKED) {
      const restored = await prisma.whitelistEntry.update({
        where: { id: existing.id },
        data: {
          status: WhitelistStatus.PENDING,
          revokedAt: null,
          name: params.name ?? existing.name,
          role: params.role,
          createdById: params.createdById,
        },
      });
      await sendInvitation(restored);
      return restored;
    }
    throw new ApiError("CONFLICT", "Bu e-posta zaten white-list'te kayıtlı.");
  }

  const entry = await prisma.whitelistEntry.create({
    data: {
      email,
      name: params.name ?? null,
      role: params.role,
      createdById: params.createdById,
    },
  });

  // FR-2.6: yeni eklenen öğrenciye asenkron davet e-postası
  await sendInvitation(entry);
  return entry;
}

// ---- CSV kaynak ----

const CSV_FORMAT_HINT =
  "Beklenen biçim — 1. satır başlık: email,name,role (name ve role opsiyonel; " +
  "Türkçe başlıklar da olur: e-posta, ad, rol). Ayraç virgül veya noktalı virgül " +
  'olabilir. Örnek satır: ogrenci@ornek.com,Ayşe Yılmaz,STUDENT';

function parseCsvRows(content: string): SpreadsheetRow[] {
  type RawRow = { email?: string; name?: string; role?: string };
  let rows: RawRow[];
  try {
    rows = parse(content, {
      columns: (header: string[]) => header.map((h) => normalizeHeader(h)),
      // Türkçe Excel CSV'yi ";" ile kaydeder — iki ayraç da kabul edilir.
      delimiter: [",", ";"],
      skip_empty_lines: true,
      trim: true,
      bom: true,
      // Eksik/fazla kolonlu satırlar dosyayı komple reddettirmesin;
      // satır bazında "Geçersiz e-posta" olarak raporlanır.
      relax_column_count: true,
      relax_quotes: true,
    }) as RawRow[];
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message.slice(0, 120)})` : "";
    throw new ApiError(
      "VALIDATION_ERROR",
      `CSV dosyası okunamadı${detail}. ${CSV_FORMAT_HINT}`,
    );
  }
  if (rows.length === 0) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `CSV'de veri satırı bulunamadı. ${CSV_FORMAT_HINT}`,
    );
  }
  // 1. satır başlık olduğundan veri satırları 2'den başlar
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    email: row.email ?? "",
    name: row.name,
    role: row.role,
  }));
}

// ---- XLSX kaynak ----

// email/name/role başlıklarının Türkçe eşdeğerleri de kabul edilir.
function normalizeHeader(header: string): string {
  const value = header.trim().toLocaleLowerCase("tr");
  if (["email", "e-posta", "eposta", "e-mail", "mail"].includes(value)) return "email";
  if (["name", "ad", "ad soyad", "isim", "adı soyadı"].includes(value)) return "name";
  if (["role", "rol"].includes(value)) return "role";
  return value;
}

async function parseXlsxRows(buffer: ArrayBuffer): Promise<SpreadsheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Excel dosyası okunamadı. Geçerli bir .xlsx yükleyin.");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) {
    throw new ApiError("VALIDATION_ERROR", "Excel dosyasında sayfa bulunamadı.");
  }

  // Başlık satırından kolon eşlemesi
  const headerRow = sheet.getRow(1);
  const columnMap = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normalizeHeader(cell.text ?? "");
    if (key && !columnMap.has(key)) columnMap.set(key, colNumber);
  });

  const emailCol = columnMap.get("email");
  if (!emailCol) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Excel dosyasında 'email' başlıklı kolon bulunamadı. ${CSV_FORMAT_HINT}`,
    );
  }
  const nameCol = columnMap.get("name");
  const roleCol = columnMap.get("role");

  const cellText = (row: ExcelJS.Row, col: number | undefined): string => {
    if (!col) return "";
    const cell = row.getCell(col);
    return (cell.text ?? "").toString().trim();
  };

  const rows: SpreadsheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // başlık
    const email = cellText(row, emailCol);
    const name = cellText(row, nameCol);
    const role = cellText(row, roleCol);
    if (!email && !name && !role) return; // tamamen boş satır
    rows.push({
      rowNumber,
      email,
      name: name || undefined,
      role: role || undefined,
    });
  });

  return rows;
}

// FR-2.2..2.5: CSV veya Excel (.xlsx) ile toplu aktarım.
// Kolonlar: email (zorunlu), name, role (opsiyonel).
export async function importWhitelistSpreadsheet(params: {
  source: ImportSource;
  createdById: string;
}): Promise<CsvImportResult> {
  const rows =
    params.source.kind === "csv"
      ? parseCsvRows(params.source.content)
      : await parseXlsxRows(params.source.buffer);

  if (rows.length === 0) {
    throw new ApiError("VALIDATION_ERROR", `Dosyada veri satırı bulunamadı. ${CSV_FORMAT_HINT}`);
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Dosya en fazla ${MAX_IMPORT_ROWS} satır içerebilir (${rows.length} satır bulundu).`,
    );
  }

  const result: CsvImportResult = {
    totalRows: rows.length,
    created: 0,
    duplicates: 0,
    invalid: 0,
    errors: [],
  };

  // Geçerli satırları topla (dosya içi mükerrerler dahil kontrol edilir)
  const seen = new Set<string>();
  const candidates: Array<{ row: number; email: string; name: string | null; role: UserRole }> =
    [];

  for (const row of rows) {
    const rawEmail = row.email ?? "";
    const email = normalizeEmail(rawEmail);

    if (!email || !isValidEmail(email)) {
      result.invalid += 1;
      result.errors.push({ row: row.rowNumber, email: rawEmail, reason: "Geçersiz e-posta" });
      continue;
    }
    if (seen.has(email)) {
      result.duplicates += 1;
      result.errors.push({ row: row.rowNumber, email, reason: "Dosya içinde mükerrer" });
      continue;
    }

    let role: UserRole = UserRole.STUDENT;
    if (row.role) {
      const normalizedRole = row.role.trim().toUpperCase();
      if (normalizedRole === UserRole.TEACHER || normalizedRole === UserRole.STUDENT) {
        role = normalizedRole as UserRole;
      } else {
        result.invalid += 1;
        result.errors.push({
          row: row.rowNumber,
          email,
          reason: `Geçersiz rol: ${row.role}`,
        });
        continue;
      }
    }

    seen.add(email);
    candidates.push({
      row: row.rowNumber,
      email,
      name: row.name?.trim() ? row.name.trim() : null,
      role,
    });
  }

  if (candidates.length === 0) return result;

  // Veritabanındaki mevcut kayıtlar (FR-2.4)
  const existingEntries = await prisma.whitelistEntry.findMany({
    where: { email: { in: candidates.map((c) => c.email) } },
    select: { email: true },
  });
  const existingEmails = new Set(existingEntries.map((e) => e.email));

  const toCreate = candidates.filter((c) => {
    if (existingEmails.has(c.email)) {
      result.duplicates += 1;
      result.errors.push({ row: c.row, email: c.email, reason: "Zaten kayıtlı" });
      return false;
    }
    return true;
  });

  for (let i = 0; i < toCreate.length; i += CREATE_CHUNK_SIZE) {
    const chunk = toCreate.slice(i, i + CREATE_CHUNK_SIZE);
    await prisma.whitelistEntry.createMany({
      data: chunk.map((c) => ({
        email: c.email,
        name: c.name,
        role: c.role,
        createdById: params.createdById,
      })),
      skipDuplicates: true,
    });
  }
  result.created = toCreate.length;

  // FR-2.6: yeni kayıtlara asenkron davet
  const createdEntries = await prisma.whitelistEntry.findMany({
    where: { email: { in: toCreate.map((c) => c.email) } },
  });
  for (const entry of createdEntries) {
    await sendInvitation(entry);
  }

  return result;
}
