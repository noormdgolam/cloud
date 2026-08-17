import { PassThrough, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import busboy from "busboy";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { reserveQuota, commitQuota, releaseQuota, QuotaExceededError } from "@/lib/quota";
import { createFileWriteStream, deleteStoredFile } from "@/lib/storage";
import { checkRateLimit, getClientIp, RateLimitExceededError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same single-shot ceiling as the main upload route — an anonymous dropper
// on someone else's request link doesn't get a chunked-upload path in v1.
const MAX_SINGLE_SHOT_BYTES = 100 * 1024 * 1024;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/requests/[token]/upload">) {
  const { token } = await ctx.params;

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
    return NextResponse.json({ error: "File too large (100MB limit)." }, { status: 413 });
  }

  if (!request.body) {
    return NextResponse.json({ error: "Empty request body." }, { status: 400 });
  }

  const fileRequest = await prisma.fileRequest.findUnique({ where: { token } });
  if (!fileRequest || fileRequest.revoked) {
    return NextResponse.json({ error: "This request link is no longer active." }, { status: 404 });
  }
  if (fileRequest.expiresAt && fileRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "This request link has expired." }, { status: 410 });
  }
  if (fileRequest.maxFiles !== null && fileRequest.fileCount >= fileRequest.maxFiles) {
    return NextResponse.json({ error: "This request has already received its file limit." }, { status: 410 });
  }

  const uploaderName = new URL(request.url).searchParams.get("name")?.trim().slice(0, 191) || null;

  // Same reasoning as /api/upload: start draining the body into busboy
  // immediately, run auth/rate-limit/DB work concurrently inside the file
  // handler rather than gating busboy's setup behind it.
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

      const buffered = new PassThrough({ highWaterMark: 4 * 1024 * 1024 });
      fileStream.pipe(buffered);

      void (async () => {
        let reserved: Awaited<ReturnType<typeof reserveQuota>> | undefined;
        try {
          const ip = getClientIp(request);
          try {
            await checkRateLimit(`${ip}:filerequest-upload`, { limit: 20, windowMs: 10 * 60 * 1000 });
          } catch (error) {
            if (error instanceof RateLimitExceededError) {
              buffered.destroy();
              settle(
                NextResponse.json(
                  { error: "Too many uploads. Try again shortly." },
                  { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
                )
              );
              return;
            }
            throw error;
          }

          reserved = await reserveQuota(
            { userId: fileRequest.userId },
            declaredSize,
            {
              originalName: filename || "untitled",
              mimeType: mimeType || "application/octet-stream",
              folderId: fileRequest.folderId,
            }
          );

          const writeStream = await createFileWriteStream(reserved.storageKey);
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

          const committed = await commitQuota(reserved.id, BigInt(bytesWritten), hash.digest("hex"));

          await prisma.$transaction([
            prisma.fileRequestUpload.create({
              data: { requestId: fileRequest.id, fileId: committed.id, uploaderName },
            }),
            prisma.fileRequest.update({
              where: { id: fileRequest.id },
              data: { fileCount: { increment: 1 } },
            }),
          ]);

          settle(
            NextResponse.json({
              file: { id: committed.id, name: committed.originalName, size: committed.size.toString() },
            })
          );
        } catch (error) {
          buffered.destroy();
          if (reserved) {
            await deleteStoredFile(reserved.storageKey).catch(() => {});
            await releaseQuota(reserved.id).catch(() => {});
          }
          if (error instanceof QuotaExceededError) {
            settle(NextResponse.json({ error: "The requester is out of storage space." }, { status: 413 }));
          } else {
            console.error("File-request upload failed:", error);
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

    pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), bb).catch((error) => {
      console.error("Request pipeline error:", error);
      settle(NextResponse.json({ error: "Upload failed." }, { status: 500 }));
    });
  });
}
