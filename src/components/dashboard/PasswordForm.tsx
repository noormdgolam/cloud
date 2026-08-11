"use client";

import { useActionState, useRef, useState } from "react";
import { changePassword } from "@/lib/actions/settings-actions";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setSaved(false);
        await action(formData);
        setSaved(true);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
        <p className="mt-1.5 text-xs text-ink-faint">At least 8 characters, one letter and one number.</p>
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </div>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {saved && !state?.error && <p className="text-sm text-success">Password updated.</p>}

      <Button type="submit" variant="accent" disabled={pending} className="w-fit px-5 py-2 text-sm">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
