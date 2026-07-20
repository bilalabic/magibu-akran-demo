"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiPost } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/constants/labels";
import { cn } from "@/lib/utils";

export type ShellUser = { id: string; name: string; email: string; role: string };

type NavItem = { href: string; label: string };

const TEACHER_NAV: NavItem[] = [
  { href: "/teacher", label: "Genel Bakış" },
  { href: "/teacher/whitelist", label: "White-list" },
  { href: "/teacher/courses", label: "Dersler" },
  { href: "/teacher/assignments", label: "Ödevler" },
  { href: "/teacher/pool", label: "Ödev Havuzu" },
];

const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Genel Bakış" },
  { href: "/student/assignments", label: "Ödevler" },
  { href: "/student/pool", label: "Ödev Havuzu" },
  { href: "/student/reviews", label: "Değerlendirmelerim" },
  { href: "/student/results", label: "Sonuçlarım" },
];

export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const nav = user.role === "TEACHER" ? TEACHER_NAV : STUDENT_NAV;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiPost("/api/auth/logout");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Çıkış yapılamadı. Tekrar deneyin.");
      setLoggingOut(false);
    }
  }

  function isActive(href: string): boolean {
    if (href === "/teacher" || href === "/student") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href={user.role === "TEACHER" ? "/teacher" : "/student"}
            className="font-semibold tracking-tight"
          >
            Akran Değerlendirme
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Çıkılıyor…" : "Çıkış"}
            </Button>
          </div>
        </div>
        <div className="border-t md:hidden">
          <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 py-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t py-4">
        <div className="mx-auto w-full max-w-6xl px-4">
          <Separator className="hidden" />
          <p className="text-xs text-muted-foreground">
            Akran Değerlendirme ve Ödev Yönetim Sistemi
          </p>
        </div>
      </footer>
    </div>
  );
}
