import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// None of these three values are secret (an OAuth client ID and a
// referrer-restricted API key are both meant to be public) — kept as
// server-only env vars anyway, not NEXT_PUBLIC_*, purely so Cloud Console
// setup iteration (referrer restrictions, scope config, swapping the
// project number) only needs a cPanel restart, not a full rebuild+redeploy.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  }

  const clientId = process.env.GOOGLE_IMPORT_CLIENT_ID;
  const apiKey = process.env.GOOGLE_PICKER_API_KEY;
  const projectNumber = process.env.GOOGLE_PROJECT_NUMBER;
  if (!clientId || !apiKey || !projectNumber) {
    return NextResponse.json({ error: "Google import isn't configured yet." }, { status: 503 });
  }

  return NextResponse.json({ clientId, apiKey, projectNumber });
}
