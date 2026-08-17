import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBytes, formatCurrency } from "@/lib/format";
import { getBillingHistory } from "@/lib/data/billing-history";
import { cn } from "@/lib/cn";
import { GlassCard } from "@/components/ui/GlassCard";
import { PlanCard } from "@/components/dashboard/PlanCard";
import { AddonPackCard } from "@/components/dashboard/AddonPackCard";

export const metadata = { title: "Storage plan" };

const ERROR_MESSAGES: Record<string, string> = {
  payment_cancel: "Payment was canceled.",
  payment_failure: "Payment failed. No charge was made.",
  payment_not_completed: "Payment wasn't completed. No charge was made.",
  confirmation_failed: "Couldn't confirm the payment. If you were charged, contact support and we'll sort it out.",
  unknown_payment: "Couldn't find that payment.",
  missing_payment_id: "Something went wrong starting checkout.",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; interval?: string }>;
}) {
  const { success, error, interval } = await searchParams;
  const yearly = interval === "yearly";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [allPlans, addonPacks, activeSubscription, user, billingHistory] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, orderBy: { priceUsdCents: "asc" } }),
    prisma.addonPack.findMany({ where: { active: true }, orderBy: { priceUsdCents: "asc" } }),
    prisma.subscription.findFirst({
      where: { userId: session.user.id, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      include: { plan: true },
      orderBy: { currentPeriodEnd: "desc" },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { quotaBytes: true } }),
    getBillingHistory(session.user.id),
  ]);

  const plans = allPlans.filter((p) => (yearly ? p.billingPeriodDays >= 365 : p.billingPeriodDays < 365));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-ink">Storage plan</h1>

      {success && (
        <GlassCard className="border-accent/40 p-4 text-sm text-ink">
          {success === "addon" ? "Payment received — your bonus storage has been added." : "Payment received — your storage has been upgraded."}
        </GlassCard>
      )}
      {error && (
        <GlassCard className="border-danger/40 p-4 text-sm text-danger">
          {ERROR_MESSAGES[error] ?? "Something went wrong with that payment."}
        </GlassCard>
      )}

      <GlassCard className="p-5">
        <h2 className="text-sm font-semibold text-ink">Current plan</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {activeSubscription ? activeSubscription.plan.name : "Free"}
          {" — "}
          {user.quotaBytes === null ? "unlimited" : formatBytes(user.quotaBytes)} total
          {activeSubscription && ` — renews ${activeSubscription.currentPeriodEnd.toLocaleDateString()}`}
        </p>
      </GlassCard>

      <div className="flex items-center gap-0.5 self-start rounded-full border border-border p-0.5">
        <Link
          href="/settings/billing"
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
            !yearly ? "bg-[var(--glass-surface)] text-ink" : "text-ink-faint"
          )}
        >
          Monthly
        </Link>
        <Link
          href="/settings/billing?interval=yearly"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
            yearly ? "bg-[var(--glass-surface)] text-ink" : "text-ink-faint"
          )}
        >
          Yearly
          <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-accent-2">
            Save ~17%
          </span>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={{
              id: plan.id,
              quotaLabel: plan.name.replace(" (yearly)", ""),
              priceUsd: (plan.priceUsdCents / 100).toFixed(2),
              priceUsdCents: plan.priceUsdCents,
              priceBdt: (plan.priceBdtPoisha / 100).toFixed(0),
              unit: yearly ? "yr" : "mo",
            }}
            current={activeSubscription?.planId === plan.id}
          />
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink">Storage add-ons</h2>
        <p className="mt-1 text-sm text-ink-muted">One-time top-ups — stack on top of any plan, never expire.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {addonPacks.map((pack) => (
            <AddonPackCard
              key={pack.id}
              pack={{
                id: pack.id,
                name: pack.name,
                priceUsd: (pack.priceUsdCents / 100).toFixed(2),
                priceUsdCents: pack.priceUsdCents,
                priceBdt: (pack.priceBdtPoisha / 100).toFixed(0),
              }}
            />
          ))}
        </div>
      </div>

      {billingHistory.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink">Billing history</h2>
          <div className="glass mt-4 flex flex-col gap-0.5 rounded-2xl p-2">
            {billingHistory.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{entry.description}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {entry.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {" · "}
                    {entry.provider === "BKASH" ? "bKash" : entry.provider === "SSLCOMMERZ" ? "Card" : "Crypto"}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-ink">
                  {formatCurrency(entry.amount, entry.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-faint">
        Payments are processed by bKash, SSLCommerz, or NOWPayments. Bongshai Cloud never sees your card or bKash PIN.
      </p>
    </div>
  );
}
