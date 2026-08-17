"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/password-reset-actions";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, undefined);
  const [email, setEmail] = useState("");

  if (state?.success) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm text-ink">
          If that email has an account, we&apos;ve sent a 6-digit code to reset your password.
        </p>
        <Link
          href={`/reset-password?email=${encodeURIComponent(email)}`}
          className="text-center text-sm font-medium text-ink hover:text-accent-2"
        >
          Enter the code
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="accent" disabled={pending} className="mt-1 w-full">
        {pending ? "Sending…" : "Send reset code"}
      </Button>
    </form>
  );
}
