import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";

const CODE_EXPIRY_MS = 15 * 60 * 1000;

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <p style="font-size: 15px; font-weight: 600; margin: 0 0 24px;">bongshai<span style="color:#8a8a8a;">.cloud</span></p>
      ${bodyHtml}
      <p style="font-size: 12px; color: #8a8a8a; margin-top: 32px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

async function sendResetCodeEmail(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: `${code} is your Bongshai Cloud password reset code`,
    html: emailShell(`
      <p style="font-size: 15px; margin: 0 0 16px;">Use this code to reset your password:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.1em; margin: 0 0 16px;">${code}</p>
      <p style="font-size: 13px; color: #5a5a5a; margin: 0;">Expires in 15 minutes.</p>
    `),
    text: `Your Bongshai Cloud password reset code is ${code}. It expires in 15 minutes.`,
  });
}

async function sendOAuthOnlyNoticeEmail(to: string): Promise<void> {
  await sendMail({
    to,
    subject: "Password reset request — Bongshai Cloud",
    html: emailShell(`
      <p style="font-size: 15px; margin: 0;">
        Someone requested a password reset for this email, but this account signs in with Google or GitHub —
        there's no password to reset. Use the "Continue with Google/GitHub" button on the sign-in page instead.
      </p>
    `),
    text: `Someone requested a password reset for this email, but this account signs in with Google or GitHub — there's no password to reset.`,
  });
}

/**
 * Always resolves without revealing whether the email has an account —
 * behavior only diverges inside the (server-only) email that gets sent, not
 * in what the caller can observe.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true } });
  if (!user) return;

  if (!user.passwordHash) {
    await sendOAuthOnlyNoticeEmail(user.email);
    return;
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.passwordResetCode.create({
    data: { userId: user.id, codeHash, expiresAt: new Date(Date.now() + CODE_EXPIRY_MS) },
  });

  await sendResetCodeEmail(user.email, code);
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error("Invalid or expired code.");

  const candidates = await prisma.passwordResetCode.findMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  let matched: (typeof candidates)[number] | null = null;
  for (const candidate of candidates) {
    if (await bcrypt.compare(code, candidate.codeHash)) {
      matched = candidate;
      break;
    }
  }
  if (!matched) throw new Error("Invalid or expired code.");

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetCode.update({ where: { id: matched.id }, data: { usedAt: new Date() } }),
    // Invalidate any other outstanding codes for this user too — a
    // successful reset should close out every code that was in flight.
    prisma.passwordResetCode.updateMany({
      where: { userId: user.id, usedAt: null, id: { not: matched.id } },
      data: { usedAt: new Date() },
    }),
  ]);
}
