import Link from "next/link";
import { DollarSign, Repeat, Package, TrendingUp } from "lucide-react";
import { getRevenueOverview } from "@/lib/data/admin-revenue";
import { formatCurrency } from "@/lib/format";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata = { title: "Backstage — Revenue" };

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 text-ink-faint">
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
        <span className="text-xs uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className="mt-2 font-mono text-xl text-ink">{value}</p>
    </GlassCard>
  );
}

export default async function BackstageRevenue() {
  const { revenueByCurrency, activeSubscriptions, addonPurchaseCount, planBreakdown, activity } =
    await getRevenueOverview();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Revenue</h1>
        <Link href="/backstage" className="text-sm text-ink-muted hover:text-ink">
          ← Overview
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {revenueByCurrency.length === 0 ? (
          <StatCard icon={DollarSign} label="Total revenue" value="$0.00" />
        ) : (
          revenueByCurrency.map((r) => (
            <StatCard
              key={r.currency}
              icon={DollarSign}
              label={`Revenue (${r.currency})`}
              value={formatCurrency(r.amount, r.currency)}
            />
          ))
        )}
        <StatCard icon={Repeat} label="Active subscriptions" value={String(activeSubscriptions)} />
        <StatCard icon={Package} label="Addon purchases" value={String(addonPurchaseCount)} />
      </div>

      <GlassCard className="p-0">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <TrendingUp className="size-4 text-ink-faint" strokeWidth={1.75} aria-hidden />
          <h2 className="text-sm font-semibold text-ink">Plan popularity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.08em] text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Purchases</th>
              </tr>
            </thead>
            <tbody>
              {planBreakdown.map((p) => (
                <tr key={p.planName} className="border-t border-border">
                  <td className="px-4 py-3 text-ink">{p.planName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{p.count}</td>
                </tr>
              ))}
              {planBreakdown.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-ink-faint">
                    No completed subscription payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-ink">Recent transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.08em] text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3 truncate text-xs text-ink-muted">{a.email}</td>
                  <td className="px-4 py-3 text-ink">{a.description}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{formatCurrency(a.amount, a.currency)}</td>
                  <td className="px-4 py-3 text-xs text-ink-faint">{a.provider === "BKASH" ? "bKash" : "Card/crypto"}</td>
                  <td className="px-4 py-3 text-xs text-ink-faint">
                    {a.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
              {activity.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-faint">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
