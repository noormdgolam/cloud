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

export async function createBkashCheckout(planId: string): Promise<{ redirectUrl: string }> {
  const userId = await requireUserId();
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId, active: true } });

  const payment = await prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      provider: "BKASH",
      // Never left as "" — the DB has a unique (provider, providerRef)
      // constraint, and an empty placeholder would collide the moment two
      // checkouts are abandoned before the provider ever returns a real
      // reference. Filled in with the real paymentID just below on success.
      providerRef: `pending-${randomUUID()}`,
      amount: plan.priceBdtPoisha,
      currency: "BDT",
      status: "PENDING",
    },
  });

  const { paymentID, bkashURL } = await createBkashPayment({
    amountBdt: (plan.priceBdtPoisha / 100).toFixed(2),
    merchantInvoiceNumber: payment.id,
    callbackURL: `${siteUrl()}/api/billing/bkash/callback`,
  });

  await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: paymentID } });

  return { redirectUrl: bkashURL };
}

export async function createCryptoCheckout(planId: string): Promise<{ redirectUrl: string }> {
  const userId = await requireUserId();
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId, active: true } });

  const payment = await prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      provider: "NOWPAYMENTS",
      providerRef: `pending-${randomUUID()}`,
      amount: plan.priceUsdCents,
      currency: "USD",
      status: "PENDING",
    },
  });

  const result = await createNowPayment({
    priceUsd: plan.priceUsdCents / 100,
    orderId: payment.id,
    orderDescription: `Bongshai Cloud — ${plan.name}`,
    ipnCallbackUrl: `${siteUrl()}/api/billing/nowpayments/webhook`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef: result.payment_id, rawPayload: JSON.stringify(result) },
  });

  // NOWPayments' create-payment response has no hosted checkout URL for a
  // direct API integration — pay_address/pay_amount is what the customer
  // sends to. A hosted-invoice flow (simpler UI, no need to display a raw
  // crypto address) would use the separate /invoice endpoint instead; worth
  // switching to once this is being wired up against real credentials.
  return { redirectUrl: `/checkout/crypto/${payment.id}` };
}

export async function createSslcommerzCheckout(planId: string): Promise<{ redirectUrl: string }> {
  const userId = await requireUserId();
  const [plan, user] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { id: planId, active: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } }),
  ]);

  // Never left as "" — the DB has a unique (provider, providerRef)
  // constraint, and an empty placeholder would collide the moment two
  // checkouts are abandoned before this gets overwritten. tran_id is ours
  // to choose (unlike bKash's paymentID or NOWPayments' payment_id, both
  // assigned by the provider) — overwritten with the payment's own id just
  // below so the callback can look it up directly, with no provider round
  // trip needed to learn what to search for.
  const payment = await prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      provider: "SSLCOMMERZ",
      providerRef: `pending-${randomUUID()}`,
      amount: plan.priceUsdCents,
      currency: "USD",
      status: "PENDING",
    },
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: payment.id } });

  const session = await createSslcommerzSession({
    amountUsd: plan.priceUsdCents / 100,
    tranId: payment.id,
    productName: `Bongshai Cloud — ${plan.name}`,
    successUrl: `${siteUrl()}/api/billing/sslcommerz/callback?result=success`,
    failUrl: `${siteUrl()}/api/billing/sslcommerz/callback?result=fail`,
    cancelUrl: `${siteUrl()}/api/billing/sslcommerz/callback?result=cancel`,
    ipnUrl: `${siteUrl()}/api/billing/sslcommerz/callback?result=success`,
    customerName: user.name ?? user.email,
    customerEmail: user.email,
  });

  return { redirectUrl: session.gatewayPageURL };
}
