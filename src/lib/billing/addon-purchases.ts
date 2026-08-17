import "server-only";
import { prisma } from "@/lib/prisma";

// Called once a provider has confirmed a one-time addon-pack payment
// succeeded. Idempotent: re-confirming an already-COMPLETED purchase is a
// no-op, so a provider retrying its webhook can't double-grant storage.
export async function activateAddonPurchase(purchaseId: string, providerRef: string) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.addonPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    if (purchase.status === "COMPLETED") return purchase;

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
