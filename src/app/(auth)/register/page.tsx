import Link from "next/link";
import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/GlassCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <GlassCard className="p-7 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Get your 25GB</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Free forever. No card required.</p>

      <div className="mt-6">
        <OAuthButtons />
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-faint">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink hover:text-accent-2">
          Sign in
        </Link>
      </p>
    </GlassCard>
  );
}
