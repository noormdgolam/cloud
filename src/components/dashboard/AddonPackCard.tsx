"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createBkashAddonCheckout, createCryptoAddonCheckout, createSslcommerzAddonCheckout } from "@/lib/actions/addon-actions";
import { MIN_CRYPTO_USD_CENTS } from "@/lib/billing/thresholds";

type Pack = {
  id: string;
  name: string;
  priceUsd: string;
  priceUsdCents: number;
  priceBdt: string;
};

export function AddonPackCard({ pack }: { pack: Pack }) {
  const [busy, setBusy] = useState<"bkash" | "card" | "crypto" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cryptoEligible = pack.priceUsdCents >= MIN_CRYPTO_USD_CENTS;

  async function pay(method: "bkash" | "card" | "crypto") {
    setBusy(method);
    setError(null);
    try {
      const { redirectUrl } =
        method === "bkash"
          ? await createBkashAddonCheckout(pack.id)
          : method === "card"
            ? await createSslcommerzAddonCheckout(pack.id)
            : await createCryptoAddonCheckout(pack.id);
      window.location.href = redirectUrl;
    } catch {
      setError("Couldn't start checkout. Try again in a moment.");
      setBusy(null);
    }
  }

  return (
    <div className="glass flex flex-col rounded-2xl p-5">
      <span className="text-xl font-semibold tracking-tight text-ink">{pack.name}</span>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-lg font-medium text-ink">${pack.priceUsd}</span>
        <span className="text-xs text-ink-faint">one-time</span>
      </div>
      <span className="mt-0.5 font-mono text-xs text-ink-faint">or ৳{pack.priceBdt}</span>

      <div className="mt-4 flex flex-col gap-2">
        <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => pay("bkash")} className="text-xs">
          {busy === "bkash" ? "Starting…" : "Pay with bKash"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => pay("card")} className="text-xs">
          {busy === "card" ? "Starting…" : "Pay with card"}
        </Button>
        {cryptoEligible && (
          <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => pay("crypto")} className="text-xs">
            {busy === "crypto" ? "Starting…" : "Pay with crypto"}
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
