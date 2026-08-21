import { requireStaff } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-enforced: cashiers and kitchen staff are redirected to /staff/denied.
  const session = await requireStaff("admin");
  const scope = await staffScope(session);

  return (
    <AdminShell
      session={{ name: session.name, role: session.role }}
      branches={scope.branches}
      currentBranchSlug={scope.current?.slug ?? null}
      branchLocked={scope.locked}
    >
      {children}
    </AdminShell>
  );
}
