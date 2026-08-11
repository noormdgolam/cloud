"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/lib/actions/settings-actions";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function DeleteAccountDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="w-full border-danger/40 text-danger hover:border-danger"
        >
          Delete account
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Delete your account?"
        description="This permanently deletes your account and every file you've uploaded. This can't be undone."
      >
        <form action={action} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="confirmEmail">
              Type <span className="font-mono text-ink">{email}</span> to confirm
            </Label>
            <Input id="confirmEmail" name="confirmEmail" type="email" autoComplete="off" required />
          </div>

          {state?.error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            variant="ghost"
            disabled={pending}
            className="w-full border-danger/40 text-danger hover:border-danger"
          >
            {pending ? "Deleting…" : "Permanently delete account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
