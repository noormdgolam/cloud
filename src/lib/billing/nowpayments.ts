// NOWPayments client — international card/crypto checkout, settling as
// USDT (TRC20) to the configured RedotPay deposit address.
//
// createPayment()'s fields are corroborated by NOWPayments' published SDK
// examples. verifyIpnSignature() implements the documented scheme (HMAC-SHA512
// over the payload with keys sorted, compared against the x-nowpayments-sig
// header) — this is the one piece that MUST be tested against a real IPN
// from the sandbox before going live, since a wrong implementation either
// rejects every real payment or (worse) accepts a forged one.
import "server-only";
import { createHmac } from "node:crypto";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Overridable for testing against the sandbox (sandbox.nowpayments.io) —
// separate account, separate API key/IPN secret from production; mixing the
// two silently fails signature verification. Never set in production.
const API_BASE = process.env.NOWPAYMENTS_API_BASE ?? "https://api.nowpayments.io/v1";

export type CreateNowPayment = {
  payment_id: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  payment_status: string;
};

export async function createNowPayment(params: {
  priceUsd: number;
  orderId: string; // our Payment.id
  orderDescription: string;
  ipnCallbackUrl: string;
  // Sandbox-only: simulates an outcome (e.g. "success", "failed") and fires
  // the matching IPN automatically, no real or testnet funds needed. Must
  // never be set against the production API.
  sandboxCase?: string;
}): Promise<CreateNowPayment> {
  const res = await fetch(`${API_BASE}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": requireEnv("NOWPAYMENTS_API_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: params.priceUsd,
      price_currency: "usd",
      pay_currency: "usdttrc20",
      // payout_address/payout_currency route settlement straight to the
      // RedotPay deposit address instead of NOWPayments' own custody wallet.
      payout_address: requireEnv("REDOTPAY_USDT_TRC20_ADDRESS"),
      payout_currency: "usdttrc20",
      order_id: params.orderId,
      order_description: params.orderDescription,
      ipn_callback_url: params.ipnCallbackUrl,
      ...(params.sandboxCase ? { case: params.sandboxCase } : {}),
    }),
  });

  if (!res.ok) throw new Error(`NOWPayments create payment failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Sorts object keys recursively and JSON-stringifies with no extra
// whitespace, matching NOWPayments' documented IPN signing scheme.
function sortedStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `"${k}":${sortedStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function verifyIpnSignature(payload: unknown, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const secret = requireEnv("NOWPAYMENTS_IPN_SECRET");
  const expected = createHmac("sha512", secret).update(sortedStringify(payload)).digest("hex");
  return expected === signatureHeader;
}

export type NowPaymentsIpnPayload = {
  payment_id: string;
  payment_status: string; // "waiting" | "confirming" | "confirmed" | "sending" | "finished" | "failed" | "expired" | "refunded"
  order_id: string;
  price_amount: number;
  price_currency: string;
};
