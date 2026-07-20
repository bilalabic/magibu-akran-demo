import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getAuthUser } from "@/lib/auth/authorization";

// Panel yerleşimi: sunucu tarafında oturum doğrulanır (proxy.ts'e ek savunma).
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      user={{ id: user.id, name: user.name, email: user.email, role: user.role }}
    >
      {children}
    </DashboardShell>
  );
}
