"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema, passwordChangeSchema } from "@/lib/validators";
import { deleteStoredFile } from "@/lib/storage";
import type { FormState } from "./auth-actions";

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated.");
  return userId;
}

export async function updateProfile(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  await prisma.user.update({ where: { id: userId }, data: { name: parsed.data.name } });
  revalidatePath("/settings");
}

export async function changePassword(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    return { error: "This account signs in with Google/GitHub — there's no password to change." };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function deleteAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (formData.get("confirmEmail") !== user.email) {
    return { error: "Type your email exactly to confirm." };
  }

  const files = await prisma.file.findMany({ where: { userId }, select: { storageKey: true } });

  // User row cascades to Account/Session/Folder/File/ShareLink via the
  // schema's onDelete rules — this only needs to also clean up the actual
  // disk blobs, which the DB has no knowledge of.
  await prisma.user.delete({ where: { id: userId } });

  await Promise.all(
    files.map((file) =>
      deleteStoredFile(file.storageKey).catch((error) => {
        console.error("Account deletion: failed to remove stored file from disk:", file.storageKey, error);
      })
    )
  );

  await signOut({ redirect: false });
  redirect("/");
}
