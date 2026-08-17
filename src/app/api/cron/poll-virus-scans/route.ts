import { NextResponse, type NextRequest } from "next/server";
import { pollPendingScans } from "@/lib/virus-scan";
import { verifyCronToken } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same HMAC-over-CRON_SECRET pattern as /api/cron/cleanup-anonymous, but
// triggered far more often (every ~10 min, see
// .github/workflows/poll-virus-scans-cron.yml) since VirusTotal analyses
// typically resolve within a minute and files sit as "Scanning…" until this
// runs.
export async function GET(request: NextRequest) {
  const token = request.headers.get("x-cron-token");
  if (!verifyCronToken("poll-virus-scans", token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pollPendingScans();
  return NextResponse.json(result);
}
