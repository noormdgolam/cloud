import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight polling target for checkout pages that have no other way to
// learn a webhook/IPN landed (e.g. the crypto flow, where nothing redirects
// the customer back to us) — scoped to the current user so it can't be used
// to probe other people's payment status by guessing ids.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { paymentId } = await params;
  const isAddon = request.nextUrl.searchParams.get("kind") === "addon";

  const record = isAddon
    ? await prisma.addonPurchase.findUnique({ where: { id: paymentId }, select: { userId: true, status: true } })
    : await prisma.payment.findUnique({ where: { id: paymentId }, select: { userId: true, status: true } });

  if (!record || record.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ status: record.status });
}
