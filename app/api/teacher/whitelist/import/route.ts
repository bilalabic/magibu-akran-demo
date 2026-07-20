import { requireTeacher } from "@/lib/auth/authorization";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import {
  importWhitelistSpreadsheet,
  type ImportSource,
} from "@/server/services/whitelist-service";

// FR-2.2: CSV veya Excel (.xlsx) ile toplu e-posta aktarımı.
// multipart/form-data ("file" alanı) veya doğrudan text/csv gövdesi kabul edilir.
const MAX_CSV_BYTES = 1024 * 1024; // 1 MB
const MAX_XLSX_BYTES = 5 * 1024 * 1024; // 5 MB

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const POST = withErrorHandling(async (req) => {
  const teacher = await requireTeacher();

  let source: ImportSource;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("VALIDATION_ERROR", "Dosya 'file' alanında gönderilmelidir.");
    }

    const isXlsx =
      file.name.toLowerCase().endsWith(".xlsx") || file.type === XLSX_MIME;

    if (isXlsx) {
      if (file.size > MAX_XLSX_BYTES) {
        throw new ApiError("VALIDATION_ERROR", "Excel dosyası en fazla 5 MB olabilir.");
      }
      source = { kind: "xlsx", buffer: await file.arrayBuffer() };
    } else {
      if (file.size > MAX_CSV_BYTES) {
        throw new ApiError("VALIDATION_ERROR", "CSV dosyası en fazla 1 MB olabilir.");
      }
      const content = await file.text();
      if (!content.trim()) {
        throw new ApiError("VALIDATION_ERROR", "CSV içeriği boş.");
      }
      source = { kind: "csv", content };
    }
  } else {
    const content = await req.text();
    if (content.length > MAX_CSV_BYTES) {
      throw new ApiError("VALIDATION_ERROR", "CSV içeriği en fazla 1 MB olabilir.");
    }
    if (!content.trim()) {
      throw new ApiError("VALIDATION_ERROR", "CSV içeriği boş.");
    }
    source = { kind: "csv", content };
  }

  const result = await importWhitelistSpreadsheet({ source, createdById: teacher.id });
  return ok(result);
});
