import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Gates every /backstage page. A non-admin (including a logged-out visitor
 * or an ordinary user who merely guesses the URL) gets a plain 404 — never
 * a redirect-to-login or an "access denied" page, since either would
 * confirm that a hidden admin area exists at all.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, isAdmin: true },
  });

  if (!user?.isAdmin) notFound();

  return user;
}
