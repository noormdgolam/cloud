import { createHmac, timingSafeEqual } from "node:crypto";

// A dedicated secret, not reused from AUTH_SECRET — env vars are set
// per-environment in cPanel's Node.js Selector UI, so there's no guarantee
// a local .env's AUTH_SECRET matches production's (it shouldn't: each
// environment should have its own). Set CRON_SECRET explicitly instead.
function expectedToken(job: string): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: CRON_SECRET");
  }
  return createHmac("sha256", secret).update(`cron:${job}`).digest("hex");
}

export function cronToken(job: string): string {
  return expectedToken(job);
}

export function verifyCronToken(job: string, providedToken: string | null): boolean {
  if (!providedToken) return false;
  const expected = Buffer.from(expectedToken(job));
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
