import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cloud } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata: Metadata = { title: "Complete payment" };

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
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}

export default async function CryptoCheckoutPage(
  props: PageProps<"/checkout/crypto/[paymentId]"> & { searchParams: Promise<{ kind?: string }> }
) {
  const { paymentId } = await props.params;
  const { kind } = await props.searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isAddon = kind === "addon";
  const record = isAddon
    ? await prisma.addonPurchase.findUnique({ where: { id: paymentId }, include: { pack: true } })
    : await prisma.payment.findUnique({ where: { id: paymentId }, include: { plan: true } });

  const unavailable = (message: string) => (
    <Shell>
      <GlassCard className="p-7 text-center sm:p-8">
        <p className="text-sm text-ink-muted">{message}</p>
      </GlassCard>
    </Shell>
  );

  if (!record || record.userId !== session.user.id) return unavailable("Payment not found.");
  if (record.status === "COMPLETED") return unavailable("This payment is already complete.");
  if (record.status !== "PENDING") return unavailable("This payment is no longer active. Start a new checkout.");

  const label = isAddon
    ? (record as { pack: { name: string } }).pack.name
    : (record as { plan: { name: string } }).plan.name;

  const details = record.rawPayload ? (JSON.parse(record.rawPayload) as { pay_address?: string; pay_amount?: number }) : null;
  if (!details?.pay_address) return unavailable("Couldn't load payment details. Try starting checkout again.");

  return (
    <Shell>
      <GlassCard className="flex flex-col gap-4 p-7 sm:p-8">
        <div>
          <h1 className="text-lg font-semibold text-ink">Send USDT (TRC20)</h1>
          <p className="mt-1 text-sm text-ink-muted">{label} — this page updates automatically once payment is detected.</p>
        </div>

        <div className="rounded-xl border border-border bg-bg-2 p-4">
          <span className="block text-xs uppercase tracking-[0.1em] text-ink-faint">Amount</span>
          <span className="mt-1 block font-mono text-lg text-ink">{details.pay_amount} USDT</span>
        </div>

        <div className="rounded-xl border border-border bg-bg-2 p-4">
          <span className="block text-xs uppercase tracking-[0.1em] text-ink-faint">Address (TRC20 network only)</span>
          <span className="mt-1 block break-all font-mono text-sm text-ink">{details.pay_address}</span>
        </div>

        <p className="text-xs text-ink-faint">
          Sending on any network other than TRC20, or a different amount, may result in lost funds.
        </p>
      </GlassCard>
    </Shell>
  );
}
