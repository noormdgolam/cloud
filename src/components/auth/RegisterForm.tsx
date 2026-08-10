"use client";

import { useActionState } from "react";
import { registerUser } from "@/lib/actions/auth-actions";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerUser, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <p className="mt-1.5 text-xs text-ink-faint">At least 8 characters, one letter and one number.</p>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="accent" disabled={pending} className="mt-1 w-full">
        {pending ? "Creating account…" : "Create free account"}
      </Button>
    </form>
  );
}
