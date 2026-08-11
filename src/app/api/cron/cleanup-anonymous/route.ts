import { NextResponse, type NextRequest } from "next/server";
import { cleanupAnonymousFiles } from "@/lib/cleanup";
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

  const result = await cleanupAnonymousFiles(30);
  return NextResponse.json(result);
}
