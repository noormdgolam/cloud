import {
  ArrowRight,
  Gauge,
  Link2,
  Lock,
  ShieldCheck,
  UploadCloud,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { LinkButton } from "@/components/ui/Button";
import { HeroPreviewPanel } from "@/components/marketing/HeroPreviewPanel";

const features = [
  {
    icon: UploadCloud,
    title: "Drag, drop, done",
    body: "Streamed uploads start writing to disk immediately — no waiting for a whole file to buffer before it moves.",
  },
  {
    icon: Lock,
    title: "Private by default",
    body: "Files live outside any public path and are only ever reachable through your session or a link you create.",
  },
  {
    icon: Link2,
    title: "Share without friction",
    body: "Generate a link with an optional expiry. No account required on the other end to download.",
  },
  {
    icon: Gauge,
    title: "Built for speed",
    body: "A persistent server process and a lean interface — no cold starts, no bloated dashboard to wait on.",
  },
  {
    icon: ShieldCheck,
    title: "Your quota, guaranteed",
    body: "Storage limits are enforced transactionally, so what you're promised is what you actually get.",
  },
  {
    icon: UserX,
    title: "Try it with zero signup",
    body: "2GB is yours the moment you land here. Create an account later, whenever it's worth it to you.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
        <div className="grid-fade glow-accent pointer-events-none absolute inset-0" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
            <Badge>Premium cloud storage</Badge>

            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
              Storage that&apos;s ready before you finish typing your email
            </h1>

            <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
              25GB free the moment you sign up. 2GB free if you never do.
              Upload, share, and forget it&apos;s even there.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/register" variant="accent" className="text-[0.95rem]">
                Claim your 25GB
                <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
              <LinkButton href="/upload" variant="ghost" className="text-[0.95rem]">
                Upload without an account
              </LinkButton>
            </div>

            <p className="mt-5 font-mono text-xs text-ink-faint">
              No credit card. No trial clock. Just storage.
            </p>
          </div>

          <div className="w-full max-w-md shrink-0">
            <HeroPreviewPanel />
          </div>
        </div>
      </section>

      <section id="tiers" className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Two tiers. Both free. No catch on either.
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <GlassCard hover className="flex flex-col p-7">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
                No account
              </span>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight text-ink">2GB</span>
                <span className="text-sm text-ink-muted">free forever</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Land on the page, drop a file, get a link. Nothing to
                remember, nothing to verify.
              </p>
              <LinkButton href="/upload" variant="ghost" className="mt-6 self-start text-sm">
                Try it now
              </LinkButton>
            </GlassCard>

            <GlassCard hover className="flex flex-col border-border-strong p-7">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-accent-2">
                Free account
              </span>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight text-ink">25GB</span>
                <span className="text-sm text-ink-muted">free forever</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Sign up with email, Google, or GitHub. Folders, rename,
                shareable links with expiry, and a real storage meter.
              </p>
              <LinkButton href="/register" variant="accent" className="mt-6 self-start text-sm">
                Create free account
              </LinkButton>
            </GlassCard>
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Everything a cloud drive should do, nothing it shouldn&apos;t
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <GlassCard key={feature.title} className="p-6">
                <feature.icon className="size-5 text-accent" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-4 text-sm font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 pt-4 sm:px-6">
        <GlassCard className="glow-accent relative mx-auto flex max-w-6xl flex-col items-center gap-5 overflow-hidden px-6 py-14 text-center sm:px-12">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Your first file is 30 seconds away
          </h2>
          <p className="max-w-md text-sm text-ink-muted sm:text-base">
            Start with 2GB right now, or sign up and get 25GB from the start.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/register" variant="accent" className="text-[0.95rem]">
              Claim your 25GB
              <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
            <LinkButton href="/upload" variant="ghost" className="text-[0.95rem]">
              Upload without an account
            </LinkButton>
          </div>
        </GlassCard>
      </section>
    </>
  );
}
