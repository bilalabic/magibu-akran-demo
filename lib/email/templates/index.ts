import type { NotificationType } from "@/lib/generated/prisma/enums";

// Türkçe e-posta şablonları. Değerler HTML'e gömülmeden önce escape edilir
// (NFR-1.7 — kullanıcı metinleri güvenli işlenir).

export type TemplateDataMap = {
  INVITATION: { name?: string | null; registerUrl: string };
  PEER_ASSIGNMENT: {
    name: string;
    assignmentTitle: string;
    count: number;
    dueAt: string;
    reviewUrl: string;
  };
  REVIEW_COMPLETED_OWNER: { assignmentTitle: string; resultsUrl: string };
  REVIEW_COMPLETED_TEACHER: {
    assignmentTitle: string;
    submissionTitle: string;
    reviewerName: string;
    completedCount: number;
    totalCount: number;
  };
  SUBMISSION_REMINDER: {
    name: string;
    assignmentTitle: string;
    endsAt: string;
    assignmentUrl: string;
  };
  REVIEW_REMINDER: { name: string; assignmentTitle: string; endsAt: string; reviewUrl: string };
  SUBMISSION_COMMENT: {
    submissionTitle: string;
    authorName: string;
    excerpt: string;
    url: string;
  };
  COMMENT_REPLY: { authorName: string; excerpt: string; url: string };
  STUDENT_REPORT: {
    name: string;
    assignmentTitle: string;
    overallAverage: string | null;
    reviewCount: number;
    resultsUrl: string;
  };
  TEACHER_WEEKLY_REPORT: { title: string; lines: string[]; url?: string };
  PASSWORD_RESET: { resetUrl: string };
};

export type RenderedEmail = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.6;">${p}</p>`).join("");
  const button = cta
    ? `<p style="margin:20px 0;"><a href="${escapeHtml(cta.url)}" style="background:#171717;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${escapeHtml(cta.label)}</a></p><p style="margin:0 0 12px;font-size:12px;color:#666;">Buton çalışmazsa bu bağlantıyı kullanın: ${escapeHtml(cta.url)}</p>`
    : "";
  return `<!doctype html><html lang="tr"><body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#171717;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(title)}</h1>
    ${body}
    ${button}
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 12px;" />
    <p style="margin:0;font-size:12px;color:#999;">Akran Değerlendirme ve Ödev Yönetim Sistemi — bu e-posta otomatik gönderilmiştir.</p>
  </div>
</body></html>`;
}

type Renderer<T extends NotificationType> = (data: TemplateDataMap[T]) => RenderedEmail;

const renderers: { [T in NotificationType]: Renderer<T> } = {
  INVITATION: (d) => {
    const greeting = d.name ? `Merhaba ${escapeHtml(d.name)},` : "Merhaba,";
    return {
      subject: "Akran Değerlendirme Sistemine Davet Edildiniz",
      html: layout(
        "Sisteme Davet",
        [
          greeting,
          "Öğretmeniniz sizi Akran Değerlendirme ve Ödev Yönetim Sistemi'ne davet etti.",
          "Aşağıdaki bağlantıdan bu e-posta adresinizle kayıt olabilirsiniz.",
        ],
        { label: "Kayıt Ol", url: d.registerUrl },
      ),
      text: `${d.name ? `Merhaba ${d.name},` : "Merhaba,"}\n\nÖğretmeniniz sizi Akran Değerlendirme ve Ödev Yönetim Sistemi'ne davet etti.\nKayıt olmak için: ${d.registerUrl}`,
    };
  },
  PEER_ASSIGNMENT: (d) => ({
    subject: `Yeni Değerlendirme Göreviniz Var: ${d.assignmentTitle}`,
    html: layout(
      "Yeni Değerlendirme Görevi",
      [
        `Merhaba ${escapeHtml(d.name)},`,
        `"${escapeHtml(d.assignmentTitle)}" ödevi için size <strong>${d.count}</strong> akran değerlendirme görevi atandı.`,
        `Son tarih: <strong>${escapeHtml(d.dueAt)}</strong>`,
      ],
      { label: "Değerlendirmelere Git", url: d.reviewUrl },
    ),
    text: `Merhaba ${d.name},\n\n"${d.assignmentTitle}" ödevi için size ${d.count} akran değerlendirme görevi atandı.\nSon tarih: ${d.dueAt}\nDeğerlendirmeler: ${d.reviewUrl}`,
  }),
  REVIEW_COMPLETED_OWNER: (d) => ({
    subject: `Tesliminiz Değerlendirildi: ${d.assignmentTitle}`,
    html: layout(
      "Yeni Değerlendirme",
      [
        "Merhaba,",
        `"${escapeHtml(d.assignmentTitle)}" ödevindeki tesliminiz için yeni bir anonim akran değerlendirmesi tamamlandı.`,
      ],
      { label: "Sonuçları Gör", url: d.resultsUrl },
    ),
    text: `Merhaba,\n\n"${d.assignmentTitle}" ödevindeki tesliminiz için yeni bir anonim akran değerlendirmesi tamamlandı.\nSonuçlar: ${d.resultsUrl}`,
  }),
  REVIEW_COMPLETED_TEACHER: (d) => ({
    subject: `Değerlendirme Tamamlandı: ${d.assignmentTitle}`,
    html: layout("Değerlendirme Tamamlandı", [
      `"${escapeHtml(d.assignmentTitle)}" ödevinde ${escapeHtml(d.reviewerName)}, "${escapeHtml(d.submissionTitle)}" teslimini değerlendirdi.`,
      `Toplam ilerleme: <strong>${d.completedCount}/${d.totalCount}</strong> değerlendirme tamamlandı.`,
    ]),
    text: `"${d.assignmentTitle}" ödevinde ${d.reviewerName}, "${d.submissionTitle}" teslimini değerlendirdi.\nToplam ilerleme: ${d.completedCount}/${d.totalCount}`,
  }),
  SUBMISSION_REMINDER: (d) => ({
    subject: `Teslim Hatırlatması: ${d.assignmentTitle}`,
    html: layout(
      "Teslim Süresi Doluyor",
      [
        `Merhaba ${escapeHtml(d.name)},`,
        `"${escapeHtml(d.assignmentTitle)}" ödevinin teslim süresi <strong>${escapeHtml(d.endsAt)}</strong> tarihinde sona eriyor ve henüz teslim yapmadınız.`,
      ],
      { label: "Teslim Yap", url: d.assignmentUrl },
    ),
    text: `Merhaba ${d.name},\n\n"${d.assignmentTitle}" ödevinin teslim süresi ${d.endsAt} tarihinde sona eriyor ve henüz teslim yapmadınız.\nTeslim: ${d.assignmentUrl}`,
  }),
  REVIEW_REMINDER: (d) => ({
    subject: `Değerlendirme Hatırlatması: ${d.assignmentTitle}`,
    html: layout(
      "Değerlendirme Süresi Doluyor",
      [
        `Merhaba ${escapeHtml(d.name)},`,
        `"${escapeHtml(d.assignmentTitle)}" ödevi için tamamlanmamış akran değerlendirmeniz var. Süre <strong>${escapeHtml(d.endsAt)}</strong> tarihinde doluyor.`,
      ],
      { label: "Değerlendirmeye Git", url: d.reviewUrl },
    ),
    text: `Merhaba ${d.name},\n\n"${d.assignmentTitle}" ödevi için tamamlanmamış akran değerlendirmeniz var. Süre ${d.endsAt} tarihinde doluyor.\nDeğerlendirme: ${d.reviewUrl}`,
  }),
  SUBMISSION_COMMENT: (d) => ({
    subject: `Tesliminize Yorum Yapıldı: ${d.submissionTitle}`,
    html: layout(
      "Yeni Yorum",
      [
        `${escapeHtml(d.authorName)}, "${escapeHtml(d.submissionTitle)}" tesliminize yorum yaptı:`,
        `<em>"${escapeHtml(d.excerpt)}"</em>`,
      ],
      { label: "Yorumu Gör", url: d.url },
    ),
    text: `${d.authorName}, "${d.submissionTitle}" tesliminize yorum yaptı:\n"${d.excerpt}"\n\nYorum: ${d.url}`,
  }),
  COMMENT_REPLY: (d) => ({
    subject: "Yorumunuza Yanıt Geldi",
    html: layout(
      "Yeni Yanıt",
      [
        `${escapeHtml(d.authorName)}, yorumunuza yanıt verdi:`,
        `<em>"${escapeHtml(d.excerpt)}"</em>`,
      ],
      { label: "Yanıtı Gör", url: d.url },
    ),
    text: `${d.authorName}, yorumunuza yanıt verdi:\n"${d.excerpt}"\n\nYanıt: ${d.url}`,
  }),
  STUDENT_REPORT: (d) => ({
    subject: `Sonuç Karneniz Hazır: ${d.assignmentTitle}`,
    html: layout(
      "Sonuç Karnesi",
      [
        `Merhaba ${escapeHtml(d.name)},`,
        `"${escapeHtml(d.assignmentTitle)}" ödevi için değerlendirme süreci tamamlandı.`,
        d.overallAverage !== null
          ? `Genel ortalamanız: <strong>${escapeHtml(d.overallAverage)}</strong> (${d.reviewCount} değerlendirme)`
          : "Tesliminiz için tamamlanmış değerlendirme bulunmuyor.",
      ],
      { label: "Karneyi Gör", url: d.resultsUrl },
    ),
    text: `Merhaba ${d.name},\n\n"${d.assignmentTitle}" ödevi için değerlendirme süreci tamamlandı.\n${d.overallAverage !== null ? `Genel ortalamanız: ${d.overallAverage} (${d.reviewCount} değerlendirme)` : "Tesliminiz için tamamlanmış değerlendirme bulunmuyor."}\nKarne: ${d.resultsUrl}`,
  }),
  TEACHER_WEEKLY_REPORT: (d) => ({
    subject: d.title,
    html: layout(
      d.title,
      d.lines.map((line) => escapeHtml(line)),
      d.url ? { label: "Raporu Gör", url: d.url } : undefined,
    ),
    text: `${d.title}\n\n${d.lines.join("\n")}${d.url ? `\n\nRapor: ${d.url}` : ""}`,
  }),
  PASSWORD_RESET: (d) => ({
    subject: "Şifre Sıfırlama Talebi",
    html: layout(
      "Şifre Sıfırlama",
      [
        "Merhaba,",
        "Hesabınız için şifre sıfırlama talebi aldık. Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
        "Bağlantı 1 saat geçerlidir.",
      ],
      { label: "Şifremi Sıfırla", url: d.resetUrl },
    ),
    text: `Merhaba,\n\nHesabınız için şifre sıfırlama talebi aldık. Bu talebi siz yapmadıysanız bu e-postayı yok sayın.\nBağlantı 1 saat geçerlidir: ${d.resetUrl}`,
  }),
};

export function renderEmail<T extends NotificationType>(
  type: T,
  data: TemplateDataMap[T],
): RenderedEmail {
  return renderers[type](data);
}
