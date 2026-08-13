import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/auth";
import { LoginForm } from "@/components/store/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const customer = await currentCustomer();
  if (customer) redirect(next ?? "/account");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <LoginForm next={next ?? "/account"} />
    </div>
  );
}
