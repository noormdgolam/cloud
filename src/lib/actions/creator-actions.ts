"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function setCreatorProgramEnabled(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in.");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { creatorProgramEnabled: enabled },
  });

  revalidatePath("/earn");
}
