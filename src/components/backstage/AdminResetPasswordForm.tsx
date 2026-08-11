"use client";

import { useActionState, useRef, useState } from "react";
import { adminResetPassword } from "@/lib/actions/admin-actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AdminResetPasswordForm({ userId }: { userId: string }) {
  const boundAction = adminResetPassword.bind(null, userId);
  const [state, action, pending] = useActionState(boundAction, undefined);
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setDone(false);
        await action(formData);
        setDone(true);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="flex-1">
        <Input name="newPassword" type="text" placeholder="New password" className="text-xs" required />
      </div>
      <Button type="submit" variant="ghost" disabled={pending} className="px-4 py-2 text-xs">
        {pending ? "Setting…" : "Set password"}
      </Button>
      {state?.error && <p className="w-full text-xs text-danger">{state.error}</p>}
      {done && !state?.error && <p className="w-full text-xs text-success">Password updated.</p>}
    </form>
  );
}
