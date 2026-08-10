import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FolderOpen, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAnonId } from "@/lib/anon-session";
import { getAnonymousFiles } from "@/lib/data/anon-files";
import { AnonymousStorageMeter } from "@/components/upload/AnonymousStorageMeter";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { FileRow } from "@/components/dashboard/FileRow";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Upload without an account" };

export default async function AnonymousUploadPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  const anonId = await getAnonId();
  const { usedBytes, quotaBytes, files } = anonId
    ? await getAnonymousFiles(anonId)
    : { usedBytes: BigInt(0), quotaBytes: BigInt(2147483648), files: [] };

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Upload without an account
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          2GB free, tied to this browser. Sign up any time to keep these files and get 25GB.
        </p>
      </div>

      <AnonymousStorageMeter usedBytes={usedBytes} quotaBytes={quotaBytes} />

      <div className="glass flex items-center gap-3 rounded-2xl p-4">
        <Sparkles className="size-4 shrink-0 text-accent-2" aria-hidden />
        <p className="flex-1 text-sm text-ink-muted">
          Clearing cookies or switching browsers resets this session. Create a free account to
          keep your files permanently.
        </p>
        <LinkButton href="/register" variant="ghost" className="shrink-0 px-3 py-1.5 text-xs">
          Sign up
        </LinkButton>
      </div>

      <UploadZone folderId={null} headerLeft={<span className="text-sm text-ink-muted">Your files</span>}>
        {files.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full border border-border bg-bg-2">
              <FolderOpen className="size-5 text-ink-faint" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm text-ink-muted">Drop a file above to get started.</p>
          </div>
        ) : (
          <div className="glass flex flex-col gap-0.5 rounded-2xl p-2">
            {files.map((file) => (
              <FileRow
                key={file.id}
                id={file.id}
                name={file.originalName}
                size={file.size}
                mimeType={file.mimeType}
                createdAt={file.createdAt}
              />
            ))}
          </div>
        )}
      </UploadZone>
    </>
  );
}
