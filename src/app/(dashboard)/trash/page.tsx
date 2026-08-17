import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { getTrashedFiles } from "@/lib/data/browser";
import { GlassCard } from "@/components/ui/GlassCard";
import { TrashRow } from "@/components/dashboard/TrashRow";

export const metadata = { title: "Trash" };

export default async function TrashPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const files = await getTrashedFiles(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Trash</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Files stay here for 30 days before being permanently deleted.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-full border border-border bg-bg-2">
            <Trash2 className="size-5 text-ink-faint" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="text-sm text-ink-muted">Trash is empty.</p>
        </div>
      ) : (
        <GlassCard className="flex flex-col gap-0.5 p-2">
          {files.map((file) => (
            <TrashRow
              key={file.id}
              id={file.id}
              name={file.originalName}
              size={file.size}
              mimeType={file.mimeType}
              deletedAt={file.deletedAt}
            />
          ))}
        </GlassCard>
      )}
    </div>
  );
}
