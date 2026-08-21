import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/session";
import { ROLE_ACCESS } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { StaffShell } from "@/components/staff/staff-shell";

export default async function StaffAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const scope = await staffScope(session);

  return (
    <StaffShell
      session={{ name: session.name, role: session.role }}
      access={ROLE_ACCESS[session.role]}
      branches={scope.branches}
      currentBranchSlug={scope.current?.slug ?? null}
      branchLocked={scope.locked}
    >
      {children}
    </StaffShell>
  );
}
