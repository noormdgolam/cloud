import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeBkashPayment } from "@/lib/billing/bkash";
import { activateAddonPurchase, markAddonPurchaseFailed } from "@/lib/billing/addon-purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mirrors /api/billing/bkash/callback but for one-time AddonPurchase rows —
// see the schema comment on AddonPack for why this is a separate route
// rather than branching the subscription callback.
export async function GET(request: NextRequest) {
  const paymentID = request.nextUrl.searchParams.get("paymentID");
  const status = request.nextUrl.searchParams.get("status");
  const siteUrl = process.env.AUTH_URL ?? "https://cloud.bongshai.com";

  if (!paymentID) {
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=missing_payment_id`);
  }

  const purchase = await prisma.addonPurchase.findFirst({ where: { providerRef: paymentID, provider: "BKASH" } });
  if (!purchase) {
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=unknown_payment`);
  }

  if (status === "cancel" || status === "failure") {
    await markAddonPurchaseFailed(purchase.id);
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=payment_${status}`);
  }

  try {
    const result = await executeBkashPayment(paymentID);
    if (result.transactionStatus !== "Completed") {
      await markAddonPurchaseFailed(purchase.id);
      return NextResponse.redirect(`${siteUrl}/settings/billing?error=payment_not_completed`);
    }

    await activateAddonPurchase(purchase.id, result.trxID ?? paymentID);
    return NextResponse.redirect(`${siteUrl}/settings/billing?success=addon`);
  } catch (error) {
    console.error("bKash addon execute payment failed:", error);
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=confirmation_failed`);
  }
}
