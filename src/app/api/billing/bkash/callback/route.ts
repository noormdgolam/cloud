import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeBkashPayment } from "@/lib/billing/bkash";
import { activateSubscription, markPaymentFailed } from "@/lib/billing/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// bKash redirects the customer's browser here after they complete (or
// cancel/fail) the payment on bKash's hosted page. The paymentID/status
// query params are attacker-controllable — they're only used to look up
// which payment to check, never trusted as proof of success. The actual
// confirmation is executeBkashPayment(), a server-to-server call back to
// bKash's own API.
export async function GET(request: NextRequest) {
  const paymentID = request.nextUrl.searchParams.get("paymentID");
  const status = request.nextUrl.searchParams.get("status");
  const siteUrl = process.env.AUTH_URL ?? "https://cloud.bongshai.com";

  if (!paymentID) {
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=missing_payment_id`);
  }

  const payment = await prisma.payment.findFirst({ where: { providerRef: paymentID, provider: "BKASH" } });
  if (!payment) {
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=unknown_payment`);
  }

  if (status === "cancel" || status === "failure") {
    await markPaymentFailed(payment.id);
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=payment_${status}`);
  }

  try {
    const result = await executeBkashPayment(paymentID);
    if (result.transactionStatus !== "Completed") {
      await markPaymentFailed(payment.id);
      return NextResponse.redirect(`${siteUrl}/settings/billing?error=payment_not_completed`);
    }

    await activateSubscription(payment.id, result.trxID ?? paymentID);
    return NextResponse.redirect(`${siteUrl}/settings/billing?success=1`);
  } catch (error) {
    console.error("bKash execute payment failed:", error);
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=confirmation_failed`);
  }
}
