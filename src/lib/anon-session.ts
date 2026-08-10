import { headers } from "next/headers";
import { ANON_HEADER_NAME } from "@/proxy";
import { prisma } from "@/lib/prisma";

/** Reads the anonymous identity `proxy.ts` attached to this request. */
export async function getAnonId(): Promise<string | null> {
  const h = await headers();
  return h.get(ANON_HEADER_NAME);
}

/**
 * Creates the AnonymousSession DB row lazily — only called from the upload
 * path, so page views alone (which always carry an anon id header) don't
 * litter the table with sessions that never uploaded anything.
 */
export async function ensureAnonymousSession(anonId: string) {
  return prisma.anonymousSession.upsert({
    where: { id: anonId },
    update: {},
    create: { id: anonId },
  });
}
