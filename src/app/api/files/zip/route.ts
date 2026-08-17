import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { ZipArchive } from "archiver";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createFileReadStream } from "@/lib/storage";
import { collectFilesByIds, collectFolderRecursive, type ZipEntry } from "@/lib/zip-selection";
import { ANON_HEADER_NAME } from "@/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const anonId = request.headers.get(ANON_HEADER_NAME);
  const identity = userId ? { userId } : anonId ? { anonymousSessionId: anonId } : null;
  if (!identity) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const idsParam = request.nextUrl.searchParams.get("ids");
  const folderId = request.nextUrl.searchParams.get("folderId");

  let entries: ZipEntry[];
  let zipName: string;
  if (folderId) {
    entries = await collectFolderRecursive(folderId, identity);
    zipName = "folder.zip";
  } else if (idsParam) {
    entries = await collectFilesByIds(idsParam.split(",").filter(Boolean), identity);
    zipName = "files.zip";
  } else {
    return NextResponse.json({ error: "Provide ids or folderId." }, { status: 400 });
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "Nothing to download." }, { status: 404 });
  }

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("warning", (err: Error) => console.error("zip warning:", err));
  archive.on("error", (err: Error) => console.error("zip error:", err));

  for (const entry of entries) {
    archive.append(createFileReadStream(entry.storageKey), { name: entry.pathInZip });
  }
  archive.finalize();

  const webStream = Readable.toWeb(archive) as unknown as NodeWebReadableStream;
  return new NextResponse(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
