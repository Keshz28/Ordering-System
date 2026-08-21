import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { floorStateFor } from "@/lib/reservations";
import { StaffFloorPlan } from "@/components/staff/staff-floor-plan";

export const metadata: Metadata = { title: "Floor plan" };
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const session = await requireStaff("pos");
  const scope = await staffScope(session);

  // Owners viewing "all branches" still need one room to look at, so fall back
  // to the first outlet rather than rendering an incoherent merged plan.
  const branch = scope.current ?? scope.branches[0] ?? null;
  const tables = branch ? await floorStateFor(branch.id) : [];

  return (
    <div className="p-4 sm:p-6">
      <StaffFloorPlan
        branchSlug={branch?.slug ?? ""}
        branchName={branch?.name ?? "No branch"}
        floorNote={branch?.floorPlanNote}
        tables={tables}
      />
    </div>
  );
}
