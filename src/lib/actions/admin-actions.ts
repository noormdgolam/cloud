"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";
import { adjustOwnerUsedBytes } from "@/lib/quota";
import { adminResetPasswordSchema } from "@/lib/validators";
import type { FormState } from "./auth-actions";

const DEFAULT_QUOTA_BYTES = BigInt(26843545600); // 25 GiB

// Stopgap for locked-out users until there's a self-service email-based
// reset flow (needs an email-sending service to be wired up first).
export async function adminResetPassword(userId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = adminResetPasswordSchema.safeParse({ newPassword: formData.get("newPassword") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the password and try again." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!target) return { error: "User not found." };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  revalidatePath(`/backstage/users/${userId}`);
}

export async function toggleUnlimited(userId: string, unlimited: boolean) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { quotaBytes: unlimited ? null : DEFAULT_QUOTA_BYTES },
  });
  revalidatePath(`/backstage/users/${userId}`);
  revalidatePath("/backstage");
}

export async function toggleAdmin(userId: string, isAdmin: boolean) {
  const admin = await requireAdmin();
  if (admin.id === userId && !isAdmin) {
    throw new Error("Can't revoke your own admin access.");
  }
  await prisma.user.update({ where: { id: userId }, data: { isAdmin } });
  revalidatePath(`/backstage/users/${userId}`);
  revalidatePath("/backstage");
}

// God-mode delete: no ownership check, works on any user's or any anonymous
// session's file. Otherwise mirrors the ordering in file-actions.ts —
// release the DB row + quota first, disk cleanup second.
export async function adminDeleteFile(fileId: string) {
  await requireAdmin();

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) return;

  await prisma.$transaction(async (tx) => {
    await adjustOwnerUsedBytes(tx, file, -file.size);
    await tx.file.delete({ where: { id: fileId } });
  });

  await deleteStoredFile(file.storageKey).catch((error) => {
    console.error("Admin delete: failed to remove stored file from disk:", file.storageKey, error);
  });

  revalidatePath(file.userId ? `/backstage/users/${file.userId}` : "/backstage/anonymous");
}

// Manually records a creator-earnings ledger entry and keeps
// User.creatorBalancePoisha in sync — CREDIT for a real ad-revenue share
// distribution, PAYOUT for recording money actually sent. Never automatic.
export async function addCreatorLedgerEntry(userId: string, formData: FormData) {
  await requireAdmin();

  const type = formData.get("type") === "PAYOUT" ? "PAYOUT" : "CREDIT";
  const amountBdt = Number(formData.get("amountBdt"));
  if (!Number.isFinite(amountBdt) || amountBdt <= 0) {
    throw new Error("Enter a positive amount.");
  }
  const amountPoisha = Math.round(amountBdt * 100);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  await prisma.$transaction(async (tx) => {
    if (type === "PAYOUT") {
      // creatorBalancePoisha >= amountPoisha baked into the update's own
      // where clause — atomic with the decrement, so a fat-fingered or
      // concurrent payout can never push the balance negative.
      const { count } = await tx.user.updateMany({
        where: { id: userId, creatorBalancePoisha: { gte: amountPoisha } },
        data: { creatorBalancePoisha: { decrement: amountPoisha } },
      });
      if (count === 0) throw new Error("Payout exceeds this creator's current balance.");
    } else {
      await tx.user.update({ where: { id: userId }, data: { creatorBalancePoisha: { increment: amountPoisha } } });
    }
    await tx.creatorLedgerEntry.create({ data: { userId, type, amountPoisha, note } });
  });

  revalidatePath(`/backstage/users/${userId}`);
}
