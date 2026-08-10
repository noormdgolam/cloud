import type { Metadata } from "next";
import { Cloud, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBytes } from "@/lib/format";
import { mimeIcon } from "@/lib/mime-icon";
import { GlassCard } from "@/components/ui/GlassCard";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Shared file" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid-fade glow-accent relative flex min-h-screen flex-col items-center justify-center bg-bg-1 px-4 py-12">
      <div className="relative mb-8 flex items-center gap-2 text-ink">
        <Cloud className="size-5 text-accent" strokeWidth={2.25} aria-hidden />
        <span className="text-[0.95rem] font-semibold tracking-tight">
          bongshai<span className="text-ink-muted">.cloud</span>
        </span>
      </div>
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}

export default async function SharePage(props: PageProps<"/s/[token]">) {
  const { token } = await props.params;
  const link = await prisma.shareLink.findUnique({ where: { token }, include: { file: true } });

  const unavailable = (message: string) => (
    <Shell>
      <GlassCard className="p-7 text-center sm:p-8">
        <p className="text-sm text-ink-muted">{message}</p>
      </GlassCard>
    </Shell>
  );

  if (!link || link.revoked) return unavailable("This link is no longer available.");
  if (link.expiresAt && link.expiresAt < new Date()) return unavailable("This link has expired.");
  if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads) {
    return unavailable("This link has reached its download limit.");
  }
  if (link.file.status !== "COMMITTED") return unavailable("File not available.");

  return (
    <Shell>
      <GlassCard className="flex flex-col items-center p-7 text-center sm:p-8">
        <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-bg-2">
          {mimeIcon(link.file.mimeType, "size-6 text-accent-2")}
        </span>
        <p className="mt-4 max-w-full truncate text-base font-medium text-ink">
          {link.file.originalName}
        </p>
        <p className="mt-1 font-mono text-xs text-ink-faint">{formatBytes(link.file.size)}</p>

        <LinkButton href={`/api/s/${token}`} variant="accent" className="mt-6 w-full">
          <Download className="size-4" aria-hidden />
          Download
        </LinkButton>

        {link.expiresAt && (
          <p className="mt-4 text-xs text-ink-faint">
            Link expires {link.expiresAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
      </GlassCard>
    </Shell>
  );
}
