import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSslcommerzPayment } from "@/lib/billing/sslcommerz";
import { activateAddonPurchase, markAddonPurchaseFailed } from "@/lib/billing/addon-purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mirrors /api/billing/sslcommerz/callback but for one-time AddonPurchase
// rows — see the schema comment on AddonPack for why this is a separate
// route rather than branching the subscription callback. Handles both GET
// and POST for the same reason as the subscription route: the IPN is
// documented POST, but the browser-facing redirect's method isn't
// confirmed either way.
async function handleCallback(request: NextRequest, tranId: string | undefined, valId: string | undefined) {
  const siteUrl = process.env.AUTH_URL ?? "https://cloud.bongshai.com";
  const result = request.nextUrl.searchParams.get("result");

  if (!tranId) {
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=missing_payment_id`, { status: 303 });
  }

  const purchase = await prisma.addonPurchase.findFirst({ where: { id: tranId, provider: "SSLCOMMERZ" } });
  if (!purchase) {
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=unknown_payment`, { status: 303 });
  }

  if (result !== "success" || !valId) {
    await markAddonPurchaseFailed(purchase.id);
    return NextResponse.redirect(`${siteUrl}/settings/billing?error=payment_${result ?? "failure"}`, { status: 303 });
  }

  try {
    const validation = await validateSslcommerzPayment(valId);
    const expectedUsd = (purchase.amount / 100).toFixed(2);
    if (!validation.valid || validation.currencyType !== "USD" || validation.amount.toFixed(2) !== expectedUsd) {
      await markAddonPurchaseFailed(purchase.id);
      return NextResponse.redirect(`${siteUrl}/settings/billing?error=payment_not_completed`, { status: 303 });
    }

    await activateAddonPurchase(purchase.id, validation.bankTranId ?? valId);
    return NextResponse.redirect(`${siteUrl}/settings/billing?success=addon`, { status: 303 });
  } catch (error) {
    console.error("SSLCommerz addon validate payment failed:", error);
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
