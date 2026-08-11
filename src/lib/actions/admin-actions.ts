"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";
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
    if (file.userId) {
      await tx.user.update({ where: { id: file.userId }, data: { usedBytes: { decrement: file.size } } });
    } else if (file.anonymousSessionId) {
      await tx.anonymousSession.update({
        where: { id: file.anonymousSessionId },
        data: { usedBytes: { decrement: file.size } },
      });
    }
    await tx.file.delete({ where: { id: fileId } });
  });

  await deleteStoredFile(file.storageKey).catch((error) => {
    console.error("Admin delete: failed to remove stored file from disk:", file.storageKey, error);
  });

  revalidatePath(file.userId ? `/backstage/users/${file.userId}` : "/backstage/anonymous");
}
