import { NextResponse, type NextRequest } from "next/server";
import { verifyIpnSignature, type NowPaymentsIpnPayload } from "@/lib/billing/nowpayments";
import { activateSubscription, markPaymentFailed } from "@/lib/billing/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL_FAILURE_STATUSES = new Set(["failed", "expired", "refunded"]);

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as NowPaymentsIpnPayload;
  const signature = request.headers.get("x-nowpayments-sig");

  if (!verifyIpnSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // order_id is our own Payment.id (set at checkout creation) — using that
  // rather than provider_ref/payment_id as the lookup key means we don't
  // depend on the update-with-providerRef call in createCryptoCheckout
  // having landed before the IPN arrives.
  const paymentId = payload.order_id;

  if (payload.payment_status === "finished") {
    await activateSubscription(paymentId, String(payload.payment_id));
  } else if (TERMINAL_FAILURE_STATUSES.has(payload.payment_status)) {
    await markPaymentFailed(paymentId);
  }
  // Any other status (waiting/confirming/sending) is a transient state —
  // acknowledge and wait for the next IPN.

  return NextResponse.json({ received: true });
}
