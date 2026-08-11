"use client";

import { useActionState, useState } from "react";
import { updateProfile } from "@/lib/actions/settings-actions";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={async (formData) => {
        setSaved(false);
        await action(formData);
        setSaved(true);
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" defaultValue={defaultName} required />
      </div>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {saved && !state?.error && <p className="text-sm text-success">Saved.</p>}

      <Button type="submit" variant="accent" disabled={pending} className="w-fit px-5 py-2 text-sm">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
