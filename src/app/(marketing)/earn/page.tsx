import type { Metadata } from "next";
import { Coins, Eye, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { getCreatorStats } from "@/lib/data/creator-earnings";
import { getUserReels } from "@/lib/data/reels";
import { GlassCard } from "@/components/ui/GlassCard";
import { LinkButton } from "@/components/ui/Button";
import { CreatorProgramToggle } from "@/components/marketing/CreatorProgramToggle";
import { UserReelsList } from "@/components/marketing/UserReelsList";

export const metadata: Metadata = {
  title: "Creator Earnings Program — Earn from your files",
  description:
    "Join the Bongshai Cloud creator program to earn 100% of collected ad revenue generated from your share links and public reels.",
};

function poishaToBdt(poisha: number): string {
  return (poisha / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const earnFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do you earn revenue from your files on Bongshai Cloud?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When you join the creator program, non-intrusive ads appear on your file share pages and reels. You receive 100% of the collected ad revenue directly credited to your account.",
      },
    },
    {
      "@type": "Question",
      name: "How are creator earnings calculated and paid out?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Earnings are credited based on actual received advertising revenue rather than estimations. Balances are held in BDT/Poisha and can be tracked in your live creator ledger.",
      },
    },
  ],
};

export default async function EarnPage() {
  const session = await auth();
  const stats = session?.user?.id ? await getCreatorStats(session.user.id) : null;
  const reels = session?.user?.id ? await getUserReels(session.user.id) : [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(earnFaqSchema) }}
      />

      <div
        className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-16 sm:px-6"
        data-mcp-action="view_creator_program"
        data-mcp-description="Overview and ledger for Bongshai Cloud 100% ad-revenue sharing creator program"
      >
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-bg-2">
            <Coins className="size-5 text-accent" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
            How do you earn revenue from your files on Bongshai Cloud?
          </h1>
          {/* Answer-first opening under 45 words */}
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Opt into the Bongshai Creator Program to earn 100% of all collected advertising revenue from views on your file share pages and public reels, credited directly to your balance with zero revenue cuts.
          </p>
        </div>

        {stats ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex justify-center sm:col-span-2">
              <CreatorProgramToggle enabled={stats.enabled} />
            </div>

            <div className="sm:col-span-2">
              <h2 className="mb-2 text-center text-sm font-semibold text-ink">
                How are your file views and creator balance tracked?
              </h2>
            </div>

            <GlassCard className="flex flex-col items-center gap-1.5 p-6 text-center">
              <Eye className="size-5 text-accent-2" strokeWidth={1.75} aria-hidden />
              <span className="text-2xl font-semibold tracking-tight text-ink">
                {stats.totalViews.toLocaleString()}
              </span>
              <span className="text-xs text-ink-faint">total views across your files</span>
            </GlassCard>

            <GlassCard className="flex flex-col items-center gap-1.5 p-6 text-center">
              <Wallet className="size-5 text-accent-2" strokeWidth={1.75} aria-hidden />
              <span className="text-2xl font-semibold tracking-tight text-ink">
                ৳{poishaToBdt(stats.balancePoisha)}
              </span>
              <span className="text-xs text-ink-faint">current balance</span>
            </GlassCard>

            {stats.recentLedger.length > 0 && (
              <div className="sm:col-span-2">
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  What is your recent earnings and payout activity?
                </h3>
                <GlassCard className="flex flex-col gap-0.5 p-2">
                  {stats.recentLedger.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-ink">
                          {entry.type === "CREDIT" ? "Earnings credit" : "Paid out"}
                        </p>
                        {entry.note && (
                          <p className="mt-0.5 truncate text-xs text-ink-faint">{entry.note}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 font-mono text-sm ${
                          entry.type === "CREDIT" ? "text-accent" : "text-ink-muted"
                        }`}
                      >
                        {entry.type === "CREDIT" ? "+" : "-"}৳{poishaToBdt(entry.amountPoisha)}
                      </span>
                    </div>
                  ))}
                </GlassCard>
              </div>
            )}

            <UserReelsList reels={reels} />

            <p className="text-xs text-ink-faint sm:col-span-2">
              Balances are credited and paid out as real ad revenue clears — this ledger reflects verified earnings recorded for your account.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-ink-muted">Sign in to see your views and balance.</p>
            <LinkButton href="/register" variant="accent" className="px-5 py-2.5 text-sm">
              Create a free account
            </LinkButton>
          </div>
        )}
      </div>
    </>
  );
}
