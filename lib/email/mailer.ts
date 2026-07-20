import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

// NFR-2.1: E-posta gönderimi request/response süresini bekletmez — bu modül
// yalnızca job endpoint'i (QStash) veya dev inline fallback tarafından çağrılır.
// EMAIL_MODE=log iken SMTP yerine konsola yazılır (dev fallback).

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type MailResult = {
  providerId: string | null;
};

type EmailMode = "smtp" | "log";

function emailMode(): EmailMode {
  const mode = process.env.EMAIL_MODE?.toLowerCase();
  if (mode === "log") return "log";
  if (mode === "smtp") return "smtp";
  // Mod belirtilmemişse: SMTP ayarı varsa smtp, yoksa log.
  return process.env.SMTP_HOST ? "smtp" : "log";
}

const globalForMailer = globalThis as unknown as { mailTransporter?: Transporter };

function transporter(): Transporter {
  if (globalForMailer.mailTransporter) return globalForMailer.mailTransporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new Error("SMTP_HOST tanımlı değil. EMAIL_MODE=log kullanın veya SMTP ayarlayın.");
  }

  const created = nodemailer.createTransport({
    pool: true,
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS ?? 5),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES ?? 100),
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 10_000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 10_000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 60_000),
  });
  globalForMailer.mailTransporter = created;
  return created;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  if (emailMode() === "log") {
    console.log(
      `[EMAIL_MODE=log] To: ${input.to} | Subject: ${input.subject}\n${input.text}`,
    );
    return { providerId: "log" };
  }

  const from = process.env.SMTP_FROM ?? "Akran Değerlendirme <noreply@example.com>";
  const info = await transporter().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return { providerId: info.messageId ?? null };
}

export function closeMailer(): void {
  globalForMailer.mailTransporter?.close();
  globalForMailer.mailTransporter = undefined;
}
