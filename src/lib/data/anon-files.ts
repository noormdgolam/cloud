import { prisma } from "@/lib/prisma";

const DEFAULT_ANON_QUOTA_BYTES = BigInt(2147483648); // 2 GiB, mirrors the schema default

export async function getAnonymousFiles(anonId: string) {
  const [session, files] = await Promise.all([
    prisma.anonymousSession.findUnique({ where: { id: anonId } }),
    prisma.file.findMany({
      where: { anonymousSessionId: anonId, status: "COMMITTED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    usedBytes: session?.usedBytes ?? BigInt(0),
    quotaBytes: session?.quotaBytes ?? DEFAULT_ANON_QUOTA_BYTES,
    claimed: Boolean(session?.claimedByUserId),
    files,
  };
}
