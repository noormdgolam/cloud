import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { REFERRAL_COOKIE_NAME } from "@/lib/cookie-names";

const protectedPrefixes = ["/dashboard", "/folder"];
const authOnlyRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

export const ANON_COOKIE_NAME = "cloud_anon_id";
export const ANON_HEADER_NAME = "x-anon-id";
export { REFERRAL_COOKIE_NAME };

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !isLoggedIn) {
    const redirectUrl = new URL("/login", req.nextUrl);
    redirectUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (authOnlyRoutes.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Every visitor gets a stable anonymous identity, even on their very first
  // request. Injecting it as a request header (not just a response cookie)
  // means the route handler serving THIS request can read it immediately —
  // the cookie alone wouldn't be visible until the next round-trip.
  const existingAnonId = req.cookies.get(ANON_COOKIE_NAME)?.value;
  const anonId = existingAnonId ?? randomBytes(24).toString("base64url");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(ANON_HEADER_NAME, anonId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existingAnonId) {
    response.cookies.set(ANON_COOKIE_NAME, anonId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  // A referral link (?ref=CODE) lands here on its way to /register or /login
  // — stash it in a cookie so it survives the redirect to an OAuth provider
  // and back, since query params don't. registerUser/events.createUser read
  // this to attribute the signup.
  const refParam = req.nextUrl.searchParams.get("ref");
  if (refParam && /^[A-Z0-9]{4,12}$/i.test(refParam)) {
    response.cookies.set(REFERRAL_COOKIE_NAME, refParam.toUpperCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
  }

  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
