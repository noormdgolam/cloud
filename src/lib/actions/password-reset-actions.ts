"use server";

import { redirect } from "next/navigation";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validators";
import { requestPasswordReset, resetPasswordWithCode } from "@/lib/password-reset";
import { checkRateLimit, RateLimitExceededError } from "@/lib/rate-limit";

export type FormState = { error?: string; success?: boolean } | undefined;

export async function requestPasswordResetAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  try {
    // Per-email, not per-IP — caps how many codes/emails one address can
    // trigger regardless of how many IPs a requester rotates through.
    await checkRateLimit(`${parsed.data.email}:request-password-reset`, { limit: 3, windowMs: 15 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      // Still report success — otherwise the rate-limit response itself
      // leaks whether the email has an account (accounts get rate-limited
      // faster than a made-up address ever could).
      return { success: true };
    }
    throw error;
  }

  try {
    await requestPasswordReset(parsed.data.email);
  } catch (error) {
    console.error("requestPasswordReset failed:", error);
    return { error: "Couldn't send the code right now. Try again in a moment." };
  }

  return { success: true };
}

export async function resetPasswordAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  try {
    // Tight limit — a 6-digit code is only 1M possibilities, so this is the
    // control that actually stops brute-forcing it, not the code's entropy.
    await checkRateLimit(`${parsed.data.email}:reset-password`, { limit: 8, windowMs: 15 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return { error: "Too many attempts. Try again in a few minutes." };
    }
    throw error;
  }

  try {
    await resetPasswordWithCode(parsed.data.email, parsed.data.code, parsed.data.newPassword);
  } catch {
    return { error: "Invalid or expired code." };
  }

  redirect("/login?reset=1");
}
