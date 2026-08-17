import Link from "next/link";
import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/GlassCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <GlassCard className="p-7 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-1.5 text-sm text-ink-muted">We&apos;ll email you a 6-digit code.</p>

      <div className="mt-6">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-ink hover:text-accent-2">
          Back to sign in
        </Link>
      </p>
    </GlassCard>
  );
}
