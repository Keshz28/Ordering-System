import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { getStaffSession } from "@/lib/session";
import { ROLE_ACCESS } from "@/lib/auth";
import { StaffLoginForm } from "@/components/staff/staff-login-form";

export const metadata: Metadata = { title: "Staff sign-in" };

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getStaffSession();
  if (session) {
    redirect(next ?? `/${ROLE_ACCESS[session.role][0]}`);
  }

  return (
    <div className="bg-trattoria grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-700 text-white shadow-lg"
          >
            <ChefHat className="size-6" />
          </Link>
          <h1 className="mt-4 font-display text-2xl text-ink-900">
            Bella Cucina back office
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Kitchen, counter and management sign in here.
          </p>
        </div>

        <StaffLoginForm next={next ?? null} />

        <p className="mt-4 text-center text-xs text-ink-500">
          Customer?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-700 underline underline-offset-2"
          >
            Sign in with your email instead
          </Link>
        </p>
      </div>
    </div>
  );
}
