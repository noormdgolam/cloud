"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Polls the payment/addon-purchase status while the customer is looking at
// the address+amount — the crypto flow has no browser redirect back from a
// provider the way bKash/SSLCommerz do, so without this the page claiming
// "updates automatically" was actually just static HTML that never changed
// until a manual refresh.
export function CryptoCheckoutStatus({ paymentId, isAddon }: { paymentId: string; isAddon: boolean }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const url = `/api/billing/status/${paymentId}${isAddon ? "?kind=addon" : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const { status } = (await res.json()) as { status: string };
        // Refresh on ANY terminal status (not just COMPLETED) — the server
        // component already has the right "already complete" / "no longer
        // active" messaging for FAILED, no need to duplicate it here.
        if (status !== "PENDING") router.refresh();
      } catch {
        // transient network hiccup — just try again next tick
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [paymentId, isAddon, router]);

  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-faint">
      <Loader2 className="size-3 animate-spin" aria-hidden />
      Waiting for payment — this updates automatically, no need to refresh.
    </p>
  );
}
