import { createHmac, timingSafeEqual } from "node:crypto";

// Password-protected share links: after a correct password check, the
// visitor gets a short-lived signed cookie scoped to that one token so
// re-checking the DB password hash on every subsequent download/page
// load isn't required. Signed (not just random) so the server never
// needs to persist active sessions per link.
const COOKIE_PREFIX = "sa_";
const MAX_AGE_MS = 30 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not set");
  return s;
}

export function shareCookieName(token: string): string {
  return `${COOKIE_PREFIX}${token}`;
}

export function shareCookieMaxAgeSeconds(): number {
  return MAX_AGE_MS / 1000;
}

export function signShareAccess(token: string): string {
  const expires = Date.now() + MAX_AGE_MS;
  const mac = createHmac("sha256", secret()).update(`${token}.${expires}`).digest("base64url");
  return `${expires}.${mac}`;
}

export function verifyShareAccess(token: string, cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  const [expiresStr, mac] = cookieValue.split(".");
  if (!expiresStr || !mac) return false;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const expected = createHmac("sha256", secret()).update(`${token}.${expires}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
