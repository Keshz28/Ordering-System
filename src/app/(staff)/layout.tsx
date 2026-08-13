import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/session";
import { ROLE_ACCESS } from "@/lib/auth";
import { StaffShell } from "@/components/staff/staff-shell";

export default async function StaffAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  return (
    <StaffShell
      session={{ name: session.name, role: session.role }}
      access={ROLE_ACCESS[session.role]}
    >
      {children}
    </StaffShell>
  );
}
