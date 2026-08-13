import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-enforced: cashiers and kitchen staff are redirected to /staff/denied.
  const session = await requireStaff("admin");

  return (
    <AdminShell session={{ name: session.name, role: session.role }}>
      {children}
    </AdminShell>
  );
}
