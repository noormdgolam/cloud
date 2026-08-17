import type { Metadata } from "next";
import { Ban, Clock, Cloud, FolderOpen, PackageCheck } from "lucide-react";
import { lookupFileRequest } from "@/lib/data/file-requests";
import { GlassCard } from "@/components/ui/GlassCard";
import { RequestDropzone } from "@/components/request/RequestDropzone";

export const metadata: Metadata = { title: "Send files" };

const STATUS_COPY: Record<string, { icon: typeof Ban; text: string }> = {
  not_found: { icon: Ban, text: "This link doesn't exist." },
  revoked: { icon: Ban, text: "This request has been closed by its owner." },
  expired: { icon: Clock, text: "This request link has expired." },
  full: { icon: PackageCheck, text: "This request has already received everything it needs." },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg-1 px-4 py-12">
      <div className="grid-fade glow-accent pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mb-8 flex items-center gap-2 text-ink">
        <Cloud className="size-5 text-accent" strokeWidth={2.25} aria-hidden />
        <span className="text-[0.95rem] font-semibold tracking-tight">
          bongshai<span className="text-ink-muted">.cloud</span>
        </span>
      </div>
      <div className="relative w-full max-w-lg">{children}</div>
    </div>
  );
}

export default async function FileRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await lookupFileRequest(token);

  if (lookup.status !== "ok") {
    const { icon: Icon, text } = STATUS_COPY[lookup.status];
    return (
      <Shell>
        <GlassCard className="flex flex-col items-center p-7 text-center sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-full border border-border bg-bg-2">
            <Icon className="size-5 text-ink-faint" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="mt-4 text-sm text-ink-muted">{text}</p>
        </GlassCard>
      </Shell>
    );
  }

  const { request } = lookup;
  const remaining = request.maxFiles !== null ? request.maxFiles - request.fileCount : null;

  return (
    <Shell>
      <div className="mb-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-bg-2">
          <FolderOpen className="size-5 text-accent" strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">{request.title}</h1>
        {request.requesterName && (
          <p className="mt-1 text-sm text-ink-muted">Requested by {request.requesterName}</p>
        )}
        {request.message && <p className="mt-3 text-sm text-ink-muted">{request.message}</p>}
        {remaining !== null && (
          <p className="mt-2 font-mono text-xs text-ink-faint">
            {remaining} of {request.maxFiles} file{request.maxFiles === 1 ? "" : "s"} remaining
          </p>
        )}
      </div>

      <GlassCard className="p-6">
        <RequestDropzone token={token} remaining={remaining} />
      </GlassCard>

      <p className="mt-6 text-center text-xs text-ink-faint">
        Files you send here go directly and privately to the requester&apos;s storage. No account needed.
      </p>
    </Shell>
  );
}
