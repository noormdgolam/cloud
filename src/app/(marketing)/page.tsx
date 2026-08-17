import { Suspense } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  HelpCircle,
  Link2,
  Lock,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { LinkButton } from "@/components/ui/Button";
import { HeroPreviewPanel } from "@/components/marketing/HeroPreviewPanel";
import { LiveStats } from "@/components/marketing/LiveStats";
import { InteractiveToolsShowcase } from "@/components/marketing/InteractiveToolsShowcase";
import { StorageComparisonTable } from "@/components/marketing/StorageComparisonTable";
import { InteractiveStorageCalculator } from "@/components/marketing/InteractiveStorageCalculator";

const features = [
  {
    icon: UploadCloud,
    question: "How do instant streamed uploads work?",
    body: "Streamed uploads write to disk immediately via chunked processing — no waiting for an entire file to buffer in memory before saving.",
  },
  {
    icon: Lock,
    question: "How is file privacy guaranteed?",
    body: "Files live outside public paths, scanned by VirusTotal fingerprints, and are only accessible through your authenticated session or tokenized share links.",
  },
  {
    icon: Link2,
    question: "How does link sharing with expiry work?",
    body: "Generate cryptographic share links with optional expiry times. Recipients can download immediately without needing a Bongshai Cloud account.",
  },
  {
    icon: Gauge,
    question: "How is server speed achieved?",
    body: "Persistent server processes and a lean React 19 architecture eliminate cold starts and provide instantaneous dashboard navigation.",
  },
  {
    icon: ShieldCheck,
    question: "How are storage quotas enforced?",
    body: "Storage allocations are enforced transactionally at upload time to guarantee you always have the dedicated capacity promised.",
  },
  {
    icon: UserX,
    question: "How do anonymous uploads work without signing up?",
    body: "Get 2GB immediately upon arrival tied to your browser cookie session. Keep your files permanently with 25GB by registering at any time.",
  },
];

const faqs = [
  {
    question: "How much free cloud storage does Bongshai Cloud provide?",
    answer:
      "Bongshai Cloud provides 25GB of permanent free storage upon registering an account, and 2GB of immediate free storage for visitors without an account.",
  },
  {
    question: "What built-in tools does Bongshai Cloud include for documents and media?",
    answer:
      "Bongshai Cloud includes a full PDF manipulation suite (Merge, Compress, Rotate, Extract, Watermark, and OCR), in-browser Word (DOCX) and Excel (XLSX) editors, an audio waveform cutter, photo EXIF/GPS stripper, and a Reels video generator.",
  },
  {
    question: "How does Bongshai Cloud compare to Google Drive, Dropbox, and WeTransfer?",
    answer:
      "Bongshai Cloud offers 25GB of permanent free storage (compared to 15GB on Google Drive and 2GB on Dropbox), 2GB zero-signup anonymous uploads, built-in PDF/Office document editors, and a 100% ad-revenue creator sharing program.",
  },
  {
    question: "How do instant streamed uploads and quotas work on Bongshai Cloud?",
    answer:
      "Uploads are streamed directly to disk in chunks without in-memory buffering, ensuring high performance. Quotas are enforced transactionally to guarantee committed storage.",
  },
  {
    question: "How does Bongshai Cloud secure files and manage shared links?",
    answer:
      "Files are stored outside public paths and accessible only via authenticated sessions or cryptographically secure share links with configurable expiration dates.",
  },
  {
    question: "How does anonymous file uploading work without creating an account?",
    answer:
      "Anonymous uploads use a secure cookie identifier tied to the browser session. Files remain active for 30 days unless claimed permanently by signing up.",
  },
  {
    question: "How does the Bongshai Cloud creator earnings program work?",
    answer:
      "Users who opt into the creator program earn 100% of the collected advertising revenue generated from views on their shared file landing pages and public reels.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://cloud.bongshai.com/#software",
      name: "Bongshai Cloud",
      applicationCategory: "CloudStorageApplication",
      operatingSystem: "Web, All modern browsers",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Privacy-first cloud storage offering 25GB free permanent storage and 2GB instant anonymous uploads with integrated PDF and Office editing tools.",
    },
    {
      "@type": "FAQPage",
      "@id": "https://cloud.bongshai.com/#faq",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      {/* Schema markup for Search & AI Citation Engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
        <div className="grid-fade glow-accent pointer-events-none absolute inset-0" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Premium Cloud Storage</Badge>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-2/80 px-2.5 py-0.5 font-mono text-[0.7rem] text-ink-faint">
                <Sparkles className="size-3 text-accent" />
                Updated August 15, 2026
              </span>
            </div>

            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
              Storage that&apos;s ready before you finish typing your email
            </h1>

            {/* Answer-First Opening (<45 words) */}
            <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
              Bongshai Cloud is a privacy-focused storage service offering 25GB free permanent storage for registered users and 2GB instant anonymous uploads without an account, featuring streamed chunked transfers, built-in PDF/Office tools, and real-time malware protection.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton
                href="/register"
                variant="accent"
                className="text-[0.95rem]"
                data-mcp-action="register_free_account"
                data-mcp-description="Claim 25GB permanent free cloud storage"
              >
                Claim your 25GB
                <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
              <LinkButton
                href="/upload"
                variant="ghost"
                className="text-[0.95rem]"
                data-mcp-action="upload_without_account"
                data-mcp-description="Upload up to 2GB anonymously without signup"
              >
                Upload without an account
              </LinkButton>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-ink-faint lg:justify-start">
              <span className="flex items-center gap-1 font-mono">
                <CheckCircle2 className="size-3.5 text-accent" /> No credit card
              </span>
              <span className="flex items-center gap-1 font-mono">
                <CheckCircle2 className="size-3.5 text-accent" /> VirusTotal verified
              </span>
              <span className="flex items-center gap-1 font-mono">
                <CheckCircle2 className="size-3.5 text-accent" /> 2GB anonymous
              </span>
            </div>

            <Suspense fallback={null}>
              <LiveStats />
            </Suspense>
          </div>

          <div className="w-full max-w-md shrink-0">
            <HeroPreviewPanel />
          </div>
        </div>
      </section>

      {/* Storage Tiers Section */}
      <section id="tiers" className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              How much free cloud storage does Bongshai Cloud provide?
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              Choose between instant anonymous file sharing or permanent registered cloud storage.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <GlassCard hover className="glow-card flex flex-col p-7">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
                Anonymous Guest Tier
              </span>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight text-ink">2GB</span>
                <span className="text-sm text-ink-muted">free forever</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Drop files immediately, generate secure download links, and manage uploads in your current browser session with zero signup required.
              </p>
              <LinkButton href="/upload" variant="ghost" className="mt-6 self-start text-sm">
                Try anonymous upload
              </LinkButton>
            </GlassCard>

            <GlassCard hover className="glow-card flex flex-col border-border-strong p-7">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-accent-2">
                Registered Account Tier
              </span>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight text-ink">25GB</span>
                <span className="text-sm text-ink-muted">free forever</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Sign in with email, Google, or GitHub. Unlock folder organization, permanent persistence, custom link expiration, and storage metering.
              </p>
              <LinkButton href="/register" variant="accent" className="mt-6 self-start text-sm">
                Create free account
              </LinkButton>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Upgraded Feature: Interactive Built-in Tools Showcase */}
      <InteractiveToolsShowcase />

      {/* Upgraded Feature: Storage Comparison Matrix */}
      <StorageComparisonTable />

      {/* Upgraded Feature: Interactive Storage Capacity Calculator */}
      <InteractiveStorageCalculator />

      {/* Architecture & Security Section */}
      <section id="features" className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              How does Bongshai Cloud secure, stream, and share your files?
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              Engineered with modern protocols, strict data isolation, and low-latency storage pipelines.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <GlassCard key={feature.question} className="glow-card p-6">
                <feature.icon className="size-5 text-accent" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-4 text-sm font-semibold text-ink">{feature.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <Badge>Answers &amp; Verification</Badge>
            <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Frequently Asked Questions About Bongshai Cloud
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Direct, verified answers to common questions about storage limits, privacy, built-in tools, and creator earnings.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {faqs.map((faq, i) => (
              <GlassCard key={i} className="glow-card p-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="mt-0.5 size-5 shrink-0 text-accent" />
                  <div>
                    <h3 className="text-base font-semibold text-ink">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{faq.answer}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 pb-24 pt-4 sm:px-6">
        <GlassCard className="glow-accent relative mx-auto flex max-w-6xl flex-col items-center gap-5 overflow-hidden px-6 py-14 text-center sm:px-12">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            How can you start storing files on Bongshai Cloud in 30 seconds?
          </h2>
          <p className="max-w-md text-sm text-ink-muted sm:text-base">
            Start uploading up to 2GB right now with no account, or create a free account to claim 25GB permanent storage.
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
