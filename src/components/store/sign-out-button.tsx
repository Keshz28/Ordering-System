"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  scope = "customer",
}: {
  scope?: "customer" | "staff";
}) {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      onClick={async () => {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope }),
        });
        router.push(scope === "staff" ? "/staff/login" : "/");
        router.refresh();
      }}
    >
      <LogOut className="size-4" /> Sign out
    </Button>
  );
}
