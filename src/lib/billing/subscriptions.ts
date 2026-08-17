import "server-only";
import { prisma } from "@/lib/prisma";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Called once a provider has confirmed a payment succeeded (bKash execute
// response, or a NOWPayments "finished" IPN) — never from a client redirect
// alone. Idempotent: re-confirming an already-COMPLETED payment is a no-op,
// so a provider retrying its webhook can't double-extend a subscription.
export async function activateSubscription(paymentId: string, providerRef: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === "COMPLETED") return payment;

    const plan = await tx.plan.findUniqueOrThrow({ where: { id: payment.planId } });

    const existing = await tx.subscription.findFirst({
      where: { userId: payment.userId, status: "ACTIVE" },
      orderBy: { currentPeriodEnd: "desc" },
    });

    // Extend from the later of (now, current period end) so renewing early
    // stacks time rather than losing the remainder of the current period.
    const base = existing && existing.currentPeriodEnd > new Date() ? existing.currentPeriodEnd : new Date();
    const newPeriodEnd = new Date(base.getTime() + plan.billingPeriodDays * ONE_DAY_MS);

    const subscription = existing
      ? await tx.subscription.update({
          where: { id: existing.id },
          data: { currentPeriodEnd: newPeriodEnd, status: "ACTIVE", planId: plan.id },
        })
      : await tx.subscription.create({
          data: { userId: payment.userId, planId: plan.id, currentPeriodEnd: newPeriodEnd },
        });

    // quotaBytes is SET (not incremented) here, so add bonusBytes back in —
    // otherwise a referral/addon bonus earned before subscribing would be
    // silently wiped out the moment the plan activates.
    const user = await tx.user.findUniqueOrThrow({ where: { id: payment.userId }, select: { bonusBytes: true } });
    await tx.user.update({
      where: { id: payment.userId },
      data: { quotaBytes: plan.quotaBytes + user.bonusBytes },
    });

    return tx.payment.update({
      where: { id: paymentId },
      data: { status: "COMPLETED", providerRef, subscriptionId: subscription.id },
    });
  });
}

export async function markPaymentFailed(paymentId: string) {
  await prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}
