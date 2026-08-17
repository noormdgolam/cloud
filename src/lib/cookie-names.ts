// Shared cookie name constants with zero other-module dependencies —
// deliberately not defined in proxy.ts, since proxy.ts imports `auth` from
// lib/auth.ts, and lib/auth.ts needs REFERRAL_COOKIE_NAME. Defining it in
// proxy.ts would make that a circular import (auth.ts -> proxy.ts -> auth.ts).
export const REFERRAL_COOKIE_NAME = "ref_code";
