import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import busboy from "busboy";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reserveQuota, commitQuota, releaseQuota, QuotaExceededError } from "@/lib/quota";
import { createFileWriteStream, deleteStoredFile } from "@/lib/storage";
import { ANON_HEADER_NAME } from "@/proxy";
import { ensureAnonymousSession } from "@/lib/anon-session";
import { checkRateLimit, getClientIp, RateLimitExceededError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single-shot streaming upload for files under ~100MB. Larger files need
// chunked upload (a later phase) to avoid tying up one long-lived request
// on hosting with a proxy idle timeout.
const MAX_SINGLE_SHOT_BYTES = 100 * 1024 * 1024;

type Owner = { userId: string } | { anonymousSessionId: string };

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  // Anonymous uploads are the higher-abuse-risk surface (no account, no
  // cost to the abuser) — cap them tighter than authenticated uploads.
  try {
    const ip = getClientIp(request);
    await checkRateLimit(`${ip}:upload:${userId ? "auth" : "anon"}`, {
      limit: userId ? 60 : 20,
      windowMs: 10 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many uploads. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  // Anonymous visitors don't have folders — folderId only applies to
  // authenticated uploads.
  const folderId = userId ? new URL(request.url).searchParams.get("folderId") : null;
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== userId) {
      return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    }
  }

  let owner: Owner;
  if (userId) {
    owner = { userId };
  } else {
    const anonId = request.headers.get(ANON_HEADER_NAME);
    if (!anonId) {
      // Should never happen — proxy.ts sets this on every matched request.
      return NextResponse.json({ error: "Could not identify session." }, { status: 400 });
    }
    await ensureAnonymousSession(anonId);
    owner = { anonymousSessionId: anonId };
  }

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (!contentLengthHeader) {
    return NextResponse.json({ error: "Content-Length header is required." }, { status: 411 });
  }

  const declaredSize = BigInt(contentLengthHeader);
  if (declaredSize > BigInt(MAX_SINGLE_SHOT_BYTES)) {
    return NextResponse.json(
      { error: "File too large for single-shot upload (100MB limit for now)." },
      { status: 413 }
    );
  }

  if (!request.body) {
    return NextResponse.json({ error: "Empty request body." }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    let settled = false;
    const settle = (response: NextResponse) => {
      if (!settled) {
        settled = true;
        resolve(response);
      }
    };

    const bb = busboy({
      headers: { "content-type": contentType },
      limits: { files: 1, fileSize: MAX_SINGLE_SHOT_BYTES },
    });

    let sawFile = false;

    bb.on("file", (_fieldName, fileStream, info) => {
      sawFile = true;
      const { filename, mimeType } = info;

      void (async () => {
        let reserved: Awaited<ReturnType<typeof reserveQuota>> | undefined;
        try {
          reserved = await reserveQuota(
            owner,
            declaredSize,
            { originalName: filename || "untitled", mimeType: mimeType || "application/octet-stream", folderId }
          );

          const writeStream = await createFileWriteStream(reserved.storageKey);
          const hash = createHash("sha256");
          let bytesWritten = 0;

          fileStream.on("data", (chunk: Buffer) => {
            bytesWritten += chunk.length;
            hash.update(chunk);
            // Defense in depth: Content-Length is an upper bound on the whole
            // multipart body, so a single file's real bytes should never
            // approach it. If a client lies, bail rather than fill the disk.
            if (BigInt(bytesWritten) > declaredSize) {
              fileStream.unpipe(writeStream);
              writeStream.destroy(new Error("Stream exceeded declared size."));
            }
          });

          await pipeline(fileStream, writeStream);

          const committed = await commitQuota(reserved.id, BigInt(bytesWritten), hash.digest("hex"));

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
          if (reserved) {
            await deleteStoredFile(reserved.storageKey).catch(() => {});
            await releaseQuota(reserved.id).catch(() => {});
          }
          if (error instanceof QuotaExceededError) {
            settle(NextResponse.json({ error: "Storage quota exceeded." }, { status: 413 }));
          } else {
            console.error("Upload failed:", error);
            settle(NextResponse.json({ error: "Upload failed." }, { status: 500 }));
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

    pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), bb).catch(
      (error) => {
        console.error("Request pipeline error:", error);
        settle(NextResponse.json({ error: "Upload failed." }, { status: 500 }));
      }
    );
  });
}
