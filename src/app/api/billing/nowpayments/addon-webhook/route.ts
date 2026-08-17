import { NextResponse, type NextRequest } from "next/server";
import { verifyIpnSignature, type NowPaymentsIpnPayload } from "@/lib/billing/nowpayments";
import { activateAddonPurchase, markAddonPurchaseFailed } from "@/lib/billing/addon-purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL_FAILURE_STATUSES = new Set(["failed", "expired", "refunded"]);

// Mirrors /api/billing/nowpayments/webhook but for one-time AddonPurchase rows.
export async function POST(request: NextRequest) {
  const payload = (await request.json()) as NowPaymentsIpnPayload;
  const signature = request.headers.get("x-nowpayments-sig");

  if (!verifyIpnSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const purchaseId = payload.order_id;

  if (payload.payment_status === "finished") {
    await activateAddonPurchase(purchaseId, String(payload.payment_id));
  } else if (TERMINAL_FAILURE_STATUSES.has(payload.payment_status)) {
    await markAddonPurchaseFailed(purchaseId);
  }

  return NextResponse.json({ received: true });
}
