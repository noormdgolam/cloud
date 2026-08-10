import { auth } from "@/lib/auth";
import { getAnonId } from "@/lib/anon-session";

export type Identity = { userId: string } | { anonymousSessionId: string };

/** Resolves the current caller's identity — works in Route Handlers, Server
 * Actions, and Server Components alike, since both `auth()` and `headers()`
 * read from the same underlying request context. */
export async function resolveIdentity(): Promise<Identity | null> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };

  const anonId = await getAnonId();
  if (anonId) return { anonymousSessionId: anonId };

  return null;
}

export function ownsRecord(
  record: { userId: string | null; anonymousSessionId: string | null },
  identity: Identity
): boolean {
  return "userId" in identity
    ? record.userId === identity.userId
    : record.anonymousSessionId === identity.anonymousSessionId;
}
