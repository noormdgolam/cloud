import { PassThrough, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import busboy from "busboy";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { reserveReplaceQuota, commitReplaceQuota, releaseReplaceQuota, QuotaExceededError } from "@/lib/quota";
import { createFileWriteStream, deleteStoredFile } from "@/lib/storage";
import { ANON_HEADER_NAME } from "@/proxy";
import { checkRateLimit, getClientIp, RateLimitExceededError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dedicated route rather than a branch inside /api/upload — replace has
// different quota math (delta-based, not absolute), different scan-retrigger
// semantics (reset to PENDING on an *existing* file, not create-fresh), and
// different concurrency guards (must re-check status/scanStatus at request
// time, not just dialog-open time). Keeping them separate keeps each legible.
const MAX_REPLACE_BYTES = 100 * 1024 * 1024;

type Identity = { userId: string } | { anonymousSessionId: string };

export async function POST(request: NextRequest, ctx: RouteContext<"/api/files/[id]/replace">) {
  const { id: fileId } = await ctx.params;

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (!contentLengthHeader) {
    return NextResponse.json({ error: "Content-Length header is required." }, { status: 411 });
  }

  const declaredSize = BigInt(contentLengthHeader);
  if (declaredSize > BigInt(MAX_REPLACE_BYTES)) {
    return NextResponse.json({ error: "File too large to save (100MB limit)." }, { status: 413 });
  }

  if (!request.body) {
    return NextResponse.json({ error: "Empty request body." }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  const anonId = request.headers.get(ANON_HEADER_NAME);
  const identity: Identity | null = userId ? { userId } : anonId ? { anonymousSessionId: anonId } : null;
  if (!identity) {
    return NextResponse.json({ error: "Could not identify session." }, { status: 401 });
  }

  try {
    const ip = getClientIp(request);
    await checkRateLimit(`${ip}:replace:${userId ? "auth" : "anon"}`, {
      limit: userId ? 60 : 20,
      windowMs: 10 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  return new Promise<NextResponse>((resolve) => {
    let settled = false;
    const settle = (response: NextResponse) => {
      if (!settled) {
        settled = true;
        resolve(response);
      }
    };

    const bb = busboy({ headers: { "content-type": contentType }, limits: { files: 1, fileSize: MAX_REPLACE_BYTES } });
    let sawFile = false;

    bb.on("file", (_fieldName, fileStream) => {
      sawFile = true;
      const buffered = new PassThrough({ highWaterMark: 4 * 1024 * 1024 });
      fileStream.pipe(buffered);

      void (async () => {
        let reservation: Awaited<ReturnType<typeof reserveReplaceQuota>> | undefined;
        try {
          reservation = await reserveReplaceQuota(fileId, identity, declaredSize);

          const writeStream = await createFileWriteStream(reservation.newStorageKey);
          const hash = createHash("sha256");
          let bytesWritten = 0;

          buffered.on("data", (chunk: Buffer) => {
            bytesWritten += chunk.length;
            hash.update(chunk);
            if (BigInt(bytesWritten) > declaredSize) {
              buffered.unpipe(writeStream);
              writeStream.destroy(new Error("Stream exceeded declared size."));
            }
          });

          await pipeline(buffered, writeStream);

          const committed = await commitReplaceQuota(
            fileId,
            reservation.newStorageKey,
            reservation.oldStorageKey,
            declaredSize,
            BigInt(bytesWritten),
            hash.digest("hex")
          );

          settle(
            NextResponse.json({
              file: {
                id: committed.id,
                name: committed.originalName,
                size: committed.size.toString(),
                mimeType: committed.mimeType,
              },
            })
          );
        } catch (error) {
          buffered.destroy();
          if (reservation) {
            await deleteStoredFile(reservation.newStorageKey).catch(() => {});
            await releaseReplaceQuota(fileId, reservation.delta).catch(() => {});
          }
          if (error instanceof QuotaExceededError) {
            settle(NextResponse.json({ error: "Storage quota exceeded." }, { status: 413 }));
          } else {
            const message = error instanceof Error ? error.message : "Save failed.";
            const knownMessages = [
              "Not found.",
              "This file isn't in an editable state.",
              "This file was flagged as malicious and can't be edited.",
            ];
            console.error("Replace failed:", error);
            settle(
              NextResponse.json(
                { error: knownMessages.includes(message) ? message : "Save failed." },
                { status: knownMessages.includes(message) ? 400 : 500 }
              )
            );
          }
        }
      })();
    });

    bb.on("error", (error) => {
      console.error("Busboy error:", error);
      settle(NextResponse.json({ error: "Malformed upload." }, { status: 400 }));
    });

    bb.on("finish", () => {
      if (!sawFile) {
        settle(NextResponse.json({ error: "No file field in upload." }, { status: 400 }));
      }
    });

    pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), bb).catch((error) => {
      console.error("Request pipeline error:", error);
      settle(NextResponse.json({ error: "Save failed." }, { status: 500 }));
    });
  });
}
