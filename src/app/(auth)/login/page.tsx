import Link from "next/link";
import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/GlassCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <GlassCard className="p-7 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Sign in to your 25GB.</p>

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

      <LoginForm />

      <p className="mt-6 text-center text-sm text-ink-muted">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-ink hover:text-accent-2">
          Create one free
        </Link>
      </p>
    </GlassCard>
  );
}
