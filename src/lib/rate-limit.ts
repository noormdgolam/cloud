import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Rate limit exceeded.");
    this.name = "RateLimitExceededError";
  }
}

/**
 * Fixed-window counter backed by the DB (not an in-memory Map) so it holds
 * up correctly if this ever runs as more than one process — a single
 * cPanel Passenger instance today, but cheap to get right now rather than
 * silently wrong later.
 */
export async function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<{ count: number; windowStart: Date }[]>`
      SELECT \`count\`, windowStart FROM RateLimitBucket WHERE \`key\` = ${key} FOR UPDATE
    `;
    const bucket = existing[0];

    if (!bucket || now.getTime() - bucket.windowStart.getTime() > windowMs) {
      await tx.rateLimitBucket.upsert({
        where: { key },
        update: { count: 1, windowStart: now },
        create: { key, count: 1, windowStart: now },
      });
      return;
    }

    if (bucket.count >= limit) {
      const retryAfterMs = windowMs - (now.getTime() - bucket.windowStart.getTime());
      throw new RateLimitExceededError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
    }

    await tx.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
  });
}

/** Best-effort real client IP behind Apache/a reverse proxy in production. */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}
