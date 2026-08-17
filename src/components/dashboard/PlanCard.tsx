"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createBkashCheckout, createCryptoCheckout, createSslcommerzCheckout } from "@/lib/actions/billing-actions";
import { MIN_CRYPTO_USD_CENTS } from "@/lib/billing/thresholds";

type Plan = {
  id: string;
  quotaLabel: string;
  priceUsd: string;
  priceUsdCents: number;
  priceBdt: string;
  unit: "mo" | "yr";
};

export function PlanCard({ plan, current }: { plan: Plan; current: boolean }) {
  const [busy, setBusy] = useState<"bkash" | "card" | "crypto" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cryptoEligible = plan.priceUsdCents >= MIN_CRYPTO_USD_CENTS;

  async function pay(method: "bkash" | "card" | "crypto") {
    setBusy(method);
    setError(null);
    try {
      const { redirectUrl } =
        method === "bkash"
          ? await createBkashCheckout(plan.id)
          : method === "card"
            ? await createSslcommerzCheckout(plan.id)
            : await createCryptoCheckout(plan.id);
      window.location.href = redirectUrl;
    } catch {
      setError("Couldn't start checkout. Try again in a moment.");
      setBusy(null);
    }
  }

  return (
    <div className="glass flex flex-col rounded-2xl border-border-strong p-6">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">{plan.quotaLabel}</span>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-ink">${plan.priceUsd}</span>
        <span className="text-sm text-ink-muted">/{plan.unit}</span>
      </div>
      <span className="mt-1 font-mono text-xs text-ink-faint">or ৳{plan.priceBdt}/{plan.unit}</span>

      {current ? (
        <span className="mt-6 rounded-full border border-border-strong px-4 py-2.5 text-center text-sm text-ink-muted">
          Current plan
        </span>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          <Button type="button" variant="accent" disabled={busy !== null} onClick={() => pay("bkash")}>
            {busy === "bkash" ? "Starting…" : "Pay with bKash"}
          </Button>
          <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => pay("card")}>
            {busy === "card" ? "Starting…" : "Pay with card"}
          </Button>
          {cryptoEligible && (
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => pay("crypto")}>
              {busy === "crypto" ? "Starting…" : "Pay with crypto"}
            </Button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
