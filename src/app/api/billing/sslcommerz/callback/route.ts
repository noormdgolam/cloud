import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSslcommerzPayment } from "@/lib/billing/sslcommerz";
import { activateSubscription, markPaymentFailed } from "@/lib/billing/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSLCommerz hits whichever of success_url/fail_url/cancel_url matched —
// all three point here, distinguished by our own `result` query param
// (SSLCommerz only tells us the outcome via which URL it hit, not a status
// field common to all three). The IPN is documented as POST; the browser
// redirect for success/fail/cancel isn't clearly documented as one method
// or the other (bKash's equivalent redirect in this codebase is GET), so
// both are handled here rather than risking a silent 405 on whichever one
// it turns out to be. The `val_id` these carry is attacker-controllable
// like bKash's paymentID; validateSslcommerzPayment() — a server-to-server
// call back to SSLCommerz's own API — is the real confirmation, matching
// bKash's executeBkashPayment() pattern.
async function handleCallback(request: NextRequest, tranId: string | undefined, valId: string | undefined) {
  const siteUrl = process.env.AUTH_URL ?? "https://cloud.bongshai.com";
  const result = request.nextUrl.searchParams.get("result");

  if (!tranId) {
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=missing_payment_id`, { status: 303 });
  }

  const payment = await prisma.payment.findFirst({ where: { id: tranId, provider: "SSLCOMMERZ" } });
  if (!payment) {
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=unknown_payment`, { status: 303 });
  }

  if (result !== "success" || !valId) {
    await markPaymentFailed(payment.id);
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=payment_${result ?? "failure"}`, { status: 303 });
  }

  try {
    const validation = await validateSslcommerzPayment(valId);
    // Cross-check amount/currency against our own record — the Validation
    // API confirming *a* payment happened isn't enough on its own, it must
    // be confirmed to be *this* payment for the amount we expect.
    const expectedUsd = (payment.amount / 100).toFixed(2);
    if (!validation.valid || validation.currencyType !== "USD" || validation.amount.toFixed(2) !== expectedUsd) {
      await markPaymentFailed(payment.id);
      return NextResponse.redirect(`${siteUrl}/settings/billing?error=payment_not_completed`, { status: 303 });
    }

    await activateSubscription(payment.id, validation.bankTranId ?? valId);
    return NextResponse.redirect(`${siteUrl}/settings/billing?success=1`, { status: 303 });
  } catch (error) {
    console.error("SSLCommerz validate payment failed:", error);
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=confirmation_failed`, { status: 303 });
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  return handleCallback(request, form.get("tran_id")?.toString(), form.get("val_id")?.toString());
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return handleCallback(request, params.get("tran_id") ?? undefined, params.get("val_id") ?? undefined);
}
