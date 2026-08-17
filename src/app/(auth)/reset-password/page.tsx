import Link from "next/link";
import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/GlassCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Enter reset code" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const searchParams = await props.searchParams;
  const emailParam = searchParams.email;
  const defaultEmail = typeof emailParam === "string" ? emailParam : "";

  return (
    <GlassCard className="p-7 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Enter your code</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Check your email for the 6-digit code.</p>

      <div className="mt-6">
        <ResetPasswordForm defaultEmail={defaultEmail} />
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/forgot-password" className="font-medium text-ink hover:text-accent-2">
          Send a new code
        </Link>
      </p>
    </GlassCard>
  );
}
