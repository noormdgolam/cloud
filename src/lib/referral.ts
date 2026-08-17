import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const GiB = 1024 ** 3;
export const REFERRER_BONUS_BYTES = BigInt(2 * GiB);
export const REFERRED_BONUS_BYTES = BigInt(1 * GiB);
// Caps how much a single account can earn from referrals — the reward still
// records who-referred-whom past this point, it just stops paying out bytes.
const MAX_REFERRER_BONUS_BYTES = BigInt(100 * GiB); // 50 referrals

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids misreads

function generateCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Referral codes are generated lazily (on first view of the referral card)
 * rather than at signup, so every signup path — credentials, Google, GitHub —
 * gets one for free without needing to touch each of those flows.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // Unique collision — vanishingly unlikely at this key space, but retry clean.
    }
  }
  throw new Error("Could not generate a unique referral code.");
}

/**
 * Attaches a new user to whoever referred them and grants both sides a
 * one-time storage bonus. Best-effort: an invalid/unknown code is silently
 * ignored rather than blocking signup. Never call this more than once per
 * new user — there's no idempotency guard here because a fresh signup only
 * ever calls it once, right after User.create.
 */
export async function applyReferral(newUserId: string, code: string | null | undefined): Promise<void> {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed) return;

  const referrerId = await prisma.user.findUnique({ where: { referralCode: trimmed }, select: { id: true } });
  if (!referrerId || referrerId.id === newUserId) return;

  await prisma.$transaction(async (tx) => {
    // Row-locked read-then-write (mirrors reserveQuota's pattern) so two
    // signups landing on the same referral code at once can't both read the
    // same pre-cap bonusBytes and each add a full bonus past the cap.
    const rows = await tx.$queryRaw<{ id: string; bonusBytes: bigint }[]>`
      SELECT id, bonusBytes FROM User WHERE id = ${referrerId.id} FOR UPDATE
    `;
    const referrer = rows[0];
    if (!referrer) return;

    const referrerBonus =
      referrer.bonusBytes >= MAX_REFERRER_BONUS_BYTES
        ? BigInt(0)
        : referrer.bonusBytes + REFERRER_BONUS_BYTES > MAX_REFERRER_BONUS_BYTES
          ? MAX_REFERRER_BONUS_BYTES - referrer.bonusBytes
          : REFERRER_BONUS_BYTES;

    await tx.user.update({
      where: { id: newUserId },
      data: {
        referredById: referrer.id,
        bonusBytes: { increment: REFERRED_BONUS_BYTES },
        quotaBytes: { increment: REFERRED_BONUS_BYTES },
      },
    });

    if (referrerBonus > BigInt(0)) {
      await tx.user.update({
        where: { id: referrer.id },
        data: {
          bonusBytes: { increment: referrerBonus },
          quotaBytes: { increment: referrerBonus },
        },
      });
    }
  });
}
