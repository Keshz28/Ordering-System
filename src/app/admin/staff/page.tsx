import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { staffActivityLog, user } from "@/db/schema";
import { requireStaff, ROLE_ACCESS } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  PageHeader,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/data";

export const metadata: Metadata = { title: "Staff & activity" };
export const dynamic = "force-dynamic";

const ROLE_NOTES = {
  owner: "Full access including settings and staff",
  manager: "Orders, menu, CRM, marketing and analytics",
  cashier: "Point of sale, tables and the kitchen display",
  kitchen: "Kitchen display only",
} as const;

export default async function AdminStaffPage() {
  await requireStaff("staff", ["owner"]);

  const [team, log] = await Promise.all([
    db.select().from(user).orderBy(user.role, user.name),
    db
      .select()
      .from(staffActivityLog)
      .orderBy(desc(staffActivityLog.createdAt))
      .limit(60),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & activity"
        description="Roles are enforced on the server for every page and API route, not just hidden in the UI."
      />

      <section>
        <h2 className="mb-3 font-display text-xl text-ink-900">Team</h2>
        <DataTable>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Can reach</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {team.map((member) => (
              <Tr key={member.id}>
                <Td className="font-medium text-ink-900">{member.name}</Td>
                <Td className="font-mono text-xs">{member.email}</Td>
                <Td>
                  <Badge
                    variant={
                      member.role === "owner"
                        ? "gold"
                        : member.role === "manager"
                          ? "default"
                          : "neutral"
                    }
                    className="capitalize"
                  >
                    {member.role}
                  </Badge>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    {ROLE_NOTES[member.role]}
                  </span>
                </Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {ROLE_ACCESS[member.role].map((area) => (
                      <Badge key={area} variant="outline">
                        {area}
                      </Badge>
                    ))}
                  </span>
                </Td>
                <Td>
                  {member.active ? (
                    <Badge variant="success">
                      <ShieldCheck className="size-3" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="danger">Disabled</Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </DataTable>
        <p className="mt-2 text-xs text-ink-500">
          Every seeded account uses the password{" "}
          <code className="rounded bg-cream-200 px-1 py-0.5">demo1234</code>.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink-900">Activity log</h2>
        <DataTable>
          <Thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th>Detail</Th>
            </tr>
          </Thead>
          <Tbody>
            {log.map((entry) => (
              <Tr key={entry.id}>
                <Td className="text-xs whitespace-nowrap">
                  <span className="block text-ink-900">
                    {relativeTime(entry.createdAt)}
                  </span>
                  <span className="text-ink-500">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </Td>
                <Td className="text-sm">{entry.userName}</Td>
                <Td className="text-sm font-medium text-ink-900">
                  {entry.action}
                </Td>
                <Td className="text-xs text-ink-500">{entry.detail}</Td>
              </Tr>
            ))}
          </Tbody>
        </DataTable>
      </section>
    </div>
  );
}
