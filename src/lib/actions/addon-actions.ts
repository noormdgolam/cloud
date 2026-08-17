"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBkashPayment } from "@/lib/billing/bkash";
import { createNowPayment } from "@/lib/billing/nowpayments";
import { createSslcommerzSession } from "@/lib/billing/sslcommerz";
import { siteUrl } from "@/lib/site-url";

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated.");
  return userId;
}

export async function createBkashAddonCheckout(packId: string): Promise<{ redirectUrl: string }> {
  const userId = await requireUserId();
  const pack = await prisma.addonPack.findUniqueOrThrow({ where: { id: packId, active: true } });

  const purchase = await prisma.addonPurchase.create({
    data: {
      userId,
      packId: pack.id,
      provider: "BKASH",
      // Never left as "" — the DB has a unique (provider, providerRef)
      // constraint, and an empty placeholder would collide the moment two
      // checkouts are abandoned before the provider ever returns a real
      // reference (updated to the real one just below on success).
      providerRef: `pending-${randomUUID()}`,
      amount: pack.priceBdtPoisha,
      currency: "BDT",
      status: "PENDING",
    },
  });

  const { paymentID, bkashURL } = await createBkashPayment({
    amountBdt: (pack.priceBdtPoisha / 100).toFixed(2),
    merchantInvoiceNumber: purchase.id,
    callbackURL: `${siteUrl()}/api/billing/bkash/addon-callback`,
  });

  await prisma.addonPurchase.update({ where: { id: purchase.id }, data: { providerRef: paymentID } });

  return { redirectUrl: bkashURL };
}

export async function createCryptoAddonCheckout(packId: string): Promise<{ redirectUrl: string }> {
  const userId = await requireUserId();
  const pack = await prisma.addonPack.findUniqueOrThrow({ where: { id: packId, active: true } });

  const purchase = await prisma.addonPurchase.create({
    data: {
      userId,
      packId: pack.id,
      provider: "NOWPAYMENTS",
      // Never left as "" — the DB has a unique (provider, providerRef)
      // constraint, and an empty placeholder would collide the moment two
      // checkouts are abandoned before the provider ever returns a real
      // reference (updated to the real one just below on success).
      providerRef: `pending-${randomUUID()}`,
      amount: pack.priceUsdCents,
      currency: "USD",
      status: "PENDING",
    },
  });

  const result = await createNowPayment({
    priceUsd: pack.priceUsdCents / 100,
    orderId: purchase.id,
    orderDescription: `Bongshai Cloud — ${pack.name} storage add-on`,
    ipnCallbackUrl: `${siteUrl()}/api/billing/nowpayments/addon-webhook`,
  });

  await prisma.addonPurchase.update({
    where: { id: purchase.id },
    data: { providerRef: result.payment_id, rawPayload: JSON.stringify(result) },
  });

  return { redirectUrl: `/checkout/crypto/${purchase.id}?kind=addon` };
}

export async function createSslcommerzAddonCheckout(packId: string): Promise<{ redirectUrl: string }> {
  const userId = await requireUserId();
  const [pack, user] = await Promise.all([
    prisma.addonPack.findUniqueOrThrow({ where: { id: packId, active: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } }),
  ]);

  const purchase = await prisma.addonPurchase.create({
    data: {
      userId,
      packId: pack.id,
      provider: "SSLCOMMERZ",
      providerRef: `pending-${randomUUID()}`,
      amount: pack.priceUsdCents,
      currency: "USD",
      status: "PENDING",
    },
  });
  // tran_id is ours to choose — overwritten with the purchase's own id so
  // the callback can look it up directly, no provider round trip needed.
  await prisma.addonPurchase.update({ where: { id: purchase.id }, data: { providerRef: purchase.id } });

  const session = await createSslcommerzSession({
    amountUsd: pack.priceUsdCents / 100,
    tranId: purchase.id,
    productName: `Bongshai Cloud — ${pack.name} storage add-on`,
    successUrl: `${siteUrl()}/api/billing/sslcommerz/addon-callback?result=success`,
    failUrl: `${siteUrl()}/api/billing/sslcommerz/addon-callback?result=fail`,
    cancelUrl: `${siteUrl()}/api/billing/sslcommerz/addon-callback?result=cancel`,
    ipnUrl: `${siteUrl()}/api/billing/sslcommerz/addon-callback?result=success`,
    customerName: user.name ?? user.email,
    customerEmail: user.email,
  });

  return { redirectUrl: session.gatewayPageURL };
}
