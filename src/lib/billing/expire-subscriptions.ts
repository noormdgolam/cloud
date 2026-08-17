import "server-only";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";

const DEFAULT_QUOTA_BYTES = BigInt(26843545600); // 25 GiB — matches User.quotaBytes's schema default

export type ExpireSubscriptionsResult = { expired: number };

// Subscriptions are never auto-renewed (every payment here is a manual
// checkout, not a recurring charge), so nothing else in the app reverts a
// user's quota once their paid period ends — this cron job is the only
// thing that does. Without it, an unrenewed subscription grants its plan's
// storage forever.
export async function expireSubscriptions(): Promise<ExpireSubscriptionsResult> {
  const expiring = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lt: new Date() } },
    include: { user: { select: { id: true, email: true, bonusBytes: true } }, plan: true },
  });

  let expired = 0;

  for (const subscription of expiring) {
    // A user could hold more than one ACTIVE subscription row historically
    // (e.g. upgraded mid-cycle) — only actually downgrade quota if this was
    // their last still-valid one.
    const stillCovered = await prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        status: "ACTIVE",
        currentPeriodEnd: { gt: new Date() },
        id: { not: subscription.id },
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "EXPIRED" } });
      if (!stillCovered) {
        await tx.user.update({
          where: { id: subscription.userId },
          data: { quotaBytes: DEFAULT_QUOTA_BYTES + subscription.user.bonusBytes },
        });
      }
    });

    if (!stillCovered) {
      await sendExpiryEmail(subscription.user.email, subscription.plan.name).catch((error) => {
        console.error("Failed to send subscription-expiry email:", error);
      });
    }

    expired++;
  }

  return { expired };
}

async function sendExpiryEmail(to: string, planName: string): Promise<void> {
  await sendMail({
    to,
    subject: "Your Bongshai Cloud plan has expired",
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <p style="font-size: 15px; font-weight: 600; margin: 0 0 24px;">bongshai<span style="color:#8a8a8a;">.cloud</span></p>
        <p style="font-size: 15px; margin: 0 0 16px;">Your <strong>${planName}</strong> plan has expired and your storage has reverted to the free tier.</p>
        <p style="font-size: 15px; margin: 0 0 16px;">Files over the free-tier limit are kept, not deleted — renew anytime to restore full access.</p>
        <p style="font-size: 13px; color: #5a5a5a; margin: 0;">Renew from Settings → Storage plan.</p>
      </div>
    `,
    text: `Your ${planName} plan has expired and your storage has reverted to the free tier. Renew anytime from Settings → Storage plan.`,
  });
}
