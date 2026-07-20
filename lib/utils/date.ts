// Tarihler veritabanında UTC saklanır; kullanıcıya gösterim ve e-posta
// metinlerinde Europe/Istanbul dilimine çevrilir.

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
});

export function formatDateTimeTr(date: Date | string): string {
  return dateTimeFormatter.format(typeof date === "string" ? new Date(date) : date);
}

export function formatDateTr(date: Date | string): string {
  return dateFormatter.format(typeof date === "string" ? new Date(date) : date);
}
