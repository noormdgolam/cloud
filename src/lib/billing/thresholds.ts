// Below this, NOWPayments rejects the crypto payment outright
// (AMOUNT_MINIMAL_ERROR) — confirmed empirically against their sandbox,
// where even $2.49 was rejected. Their own docs put the real minimum around
// $2-5 depending on market conditions and expose a /v1/min-amount endpoint
// for the exact current value, but that fluctuates with network fees; $10
// is a simple, comfortably-safe static floor rather than a live lookup on
// every page render. No isomorphic import restriction (unlike the billing
// clients themselves) — safe to use directly in client components.
export const MIN_CRYPTO_USD_CENTS = 1000;
