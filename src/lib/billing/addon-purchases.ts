import "server-only";
import { prisma } from "@/lib/prisma";

// Called once a provider has confirmed a one-time addon-pack payment
// succeeded. Idempotent: re-confirming an already-COMPLETED purchase is a
// no-op, so a provider retrying its webhook can't double-grant storage.
export async function activateAddonPurchase(purchaseId: string, providerRef: string) {
  return prisma.$transaction(async (tx) => {
    // FOR UPDATE — see the identical comment in subscriptions.ts's
    // activateSubscription. Without the lock, a retried webhook can double-
    // grant bonusBytes/quotaBytes below (both use increment, not set).
    const rows = await tx.$queryRaw<{ status: string; packId: string; userId: string }[]>`
      SELECT status, packId, userId FROM AddonPurchase WHERE id = ${purchaseId} FOR UPDATE
    `;
    const purchase = rows[0];
    if (!purchase) throw new Error(`Addon purchase not found: ${purchaseId}`);
    if (purchase.status === "COMPLETED") return tx.addonPurchase.findUniqueOrThrow({ where: { id: purchaseId } });

    const pack = await tx.addonPack.findUniqueOrThrow({ where: { id: purchase.packId } });

    await tx.user.update({
      where: { id: purchase.userId },
      data: {
        bonusBytes: { increment: pack.bonusBytes },
        quotaBytes: { increment: pack.bonusBytes },
      },
    });

    return tx.addonPurchase.update({
      where: { id: purchaseId },
      data: { status: "COMPLETED", providerRef },
    });
  });
}

export async function markAddonPurchaseFailed(purchaseId: string) {
  await prisma.addonPurchase.updateMany({
    where: { id: purchaseId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}
