import { randomUUID, createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";

function storageRoot(): string {
  const root = process.env.STORAGE_ROOT;
  if (!root) {
    throw new Error("STORAGE_ROOT environment variable is not set.");
  }
  return root;
}

// STORAGE_ROOT/{uuid[0:2]}/{uuid[2:4]}/{uuid}.bin — the path is always derived
// from a server-generated UUID, never from client input, which structurally
// rules out path traversal rather than relying on sanitizing a filename.
export function resolveStoragePath(storageKey: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey)) {
    throw new Error("Invalid storage key.");
  }
  const clean = storageKey.replace(/-/g, "");
  const shard1 = clean.slice(0, 2);
  const shard2 = clean.slice(2, 4);
  return path.join(storageRoot(), shard1, shard2, `${storageKey}.bin`);
}

export function generateStorageKey(): string {
  return randomUUID();
}

export async function ensureStorageDirFor(storageKey: string): Promise<string> {
  const filePath = resolveStoragePath(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  return filePath;
}

export async function createFileWriteStream(storageKey: string) {
  const filePath = await ensureStorageDirFor(storageKey);
  return createWriteStream(filePath, { flags: "wx" }); // fail if it somehow already exists
}

export function createFileReadStream(
  storageKey: string,
  range?: { start: number; end: number }
) {
  const filePath = resolveStoragePath(storageKey);
  return range
    ? createReadStream(filePath, { start: range.start, end: range.end })
    : createReadStream(filePath);
}

export async function getStoredFileSize(storageKey: string): Promise<number> {
  const filePath = resolveStoragePath(storageKey);
  const info = await stat(filePath);
  return info.size;
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  const filePath = resolveStoragePath(storageKey);
  await rm(filePath, { force: true });
}

// --- Chunked upload (large files) ---
// Chunks land in STORAGE_ROOT/tmp/{uploadId}/{chunkIndex}.part before being
// concatenated into the final sharded path on completion. uploadId is
// always a Prisma cuid (validated below), never client-controlled text.

function validUploadId(uploadId: string): boolean {
  return /^[a-z0-9]{20,32}$/i.test(uploadId);
}

function tempChunkDir(uploadId: string): string {
  if (!validUploadId(uploadId)) {
    throw new Error("Invalid upload id.");
  }
  return path.join(storageRoot(), "tmp", uploadId);
}

function tempChunkPath(uploadId: string, chunkIndex: number): string {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error("Invalid chunk index.");
  }
  return path.join(tempChunkDir(uploadId), `${chunkIndex}.part`);
}

export async function writeUploadChunk(
  uploadId: string,
  chunkIndex: number,
  nodeReadable: NodeJS.ReadableStream
): Promise<number> {
  const chunkPath = tempChunkPath(uploadId, chunkIndex);
  await mkdir(path.dirname(chunkPath), { recursive: true });
  const writeStream = createWriteStream(chunkPath, { flags: "w" });
  await pipeline(nodeReadable, writeStream);
  const info = await stat(chunkPath);
  return info.size;
}

export async function assembleChunks(
  uploadId: string,
  totalChunks: number,
  storageKey: string
): Promise<{ size: number; sha256: string }> {
  const dir = tempChunkDir(uploadId);
  const entries = await readdir(dir).catch((): string[] => []);
  for (let i = 0; i < totalChunks; i++) {
    if (!entries.includes(`${i}.part`)) {
      throw new Error(`Missing chunk ${i} of ${totalChunks}.`);
    }
  }

  const finalPath = await ensureStorageDirFor(storageKey);
  const writeStream = createWriteStream(finalPath, { flags: "wx" });
  const hash = createHash("sha256");
  let size = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = tempChunkPath(uploadId, i);
    await new Promise<void>((resolve, reject) => {
      const readStream = createReadStream(chunkPath);
      readStream.on("data", (chunk: string | Buffer) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        size += buf.length;
        hash.update(buf);
      });
      readStream.on("error", reject);
      readStream.on("end", resolve);
      readStream.pipe(writeStream, { end: false });
    });
  }
  writeStream.end();
  await new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  await rm(dir, { recursive: true, force: true });

  return { size, sha256: hash.digest("hex") };
}

export async function cleanupChunks(uploadId: string): Promise<void> {
  await rm(tempChunkDir(uploadId), { recursive: true, force: true });
}
