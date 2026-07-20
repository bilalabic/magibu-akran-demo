// NFR-1.8: Dış bağlantılar yeni sekmede noopener+noreferrer ile açılır.
export type SubmissionLinkItem = {
  id?: string;
  label: string | null;
  url: string;
};

export function LinkList({ links }: { links: SubmissionLinkItem[] }) {
  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">Bağlantı yok.</p>;
  }
  return (
    <ul className="space-y-1">
      {links.map((link, index) => (
        <li key={link.id ?? index} className="text-sm">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-4 hover:opacity-80"
          >
            {link.label ? `${link.label} — ${link.url}` : link.url}
          </a>
        </li>
      ))}
    </ul>
  );
}
