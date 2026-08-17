import { NextResponse, type NextRequest } from "next/server";
import { cleanupAnonymousFiles, purgeOldTrash } from "@/lib/cleanup";
import { expireSubscriptions } from "@/lib/billing/expire-subscriptions";
import { verifyCronToken } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public route, but gated by a token derived from AUTH_SECRET — see
// src/lib/cron-auth.ts. Intended to be hit on a schedule by an external
// trigger (GitHub Actions cron) since this host doesn't give us a reliable
// way to run scheduled jobs on the server itself.
export async function GET(request: NextRequest) {
  const token = request.headers.get("x-cron-token");
  if (!verifyCronToken("cleanup-anonymous", token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Runs alongside the anonymous-file sweep in the same scheduled hit
  // rather than needing its own separate cron trigger configured.
  // allSettled (not all) — these three jobs are independent, and one
  // throwing shouldn't hide whether the other two actually succeeded, nor
  // turn the whole hit into an opaque 500 for a problem in just one of them.
  const [anonymous, trash, subscriptions] = await Promise.allSettled([
    cleanupAnonymousFiles(30),
    purgeOldTrash(30),
    expireSubscriptions(),
  ]);
  const summarize = (r: PromiseSettledResult<unknown>) => (r.status === "fulfilled" ? r.value : { error: String(r.reason) });
  const anyFailed = [anonymous, trash, subscriptions].some((r) => r.status === "rejected");

  return NextResponse.json(
    { anonymous: summarize(anonymous), trash: summarize(trash), subscriptions: summarize(subscriptions) },
    { status: anyFailed ? 500 : 200 }
  );
}
