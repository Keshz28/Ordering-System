import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getStaffSession } from "@/lib/session";
import { ROLE_ACCESS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/store/sign-out-button";

export default async function AccessDeniedPage() {
  const session = await getStaffSession();
  const allowed = session ? ROLE_ACCESS[session.role] : [];

  return (
    <div className="bg-trattoria grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-card border border-cream-400 bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldAlert className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl text-ink-900">
          Not your area
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          {session
            ? `The ${session.role} role doesn't have access to that screen. Roles are enforced on the server, not just hidden in the UI.`
            : "You need to sign in first."}
        </p>

        {allowed.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {allowed
              .filter((a) => ["admin", "pos", "kds"].includes(a))
              .map((area) => (
                <Button key={area} variant="outline" asChild>
                  <Link href={`/${area}`}>
                    {area === "admin"
                      ? "Admin"
                      : area === "pos"
                        ? "POS"
                        : "Kitchen"}
                  </Link>
                </Button>
              ))}
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <SignOutButton scope="staff" />
        </div>
      </div>
    </div>
  );
}
