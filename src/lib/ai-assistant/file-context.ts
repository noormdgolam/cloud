import "server-only";
import { prisma } from "@/lib/prisma";
import { previewKind } from "@/lib/mime-preview";
import { resolveStoragePath } from "@/lib/storage";
import { readFile } from "node:fs/promises";
import { type Identity, ownsRecord } from "@/lib/identity";

const MAX_CONTEXT_BYTES = 60 * 1024; // ~15k tokens' worth — enough for most notes/code/logs without blowing the prompt budget

function ownsFile(file: { userId: string | null; anonymousSessionId: string | null }, identity: Identity): boolean {
  return ownsRecord(file, identity);
}

export type FileContextResult = { name: string; content: string } | { name: string; error: string };

/**
 * Loads a text file's content for the assistant to answer questions about.
 * Scoped to plain-text-ish mimetypes only (previewKind === "text") — the
 * same set the in-app text preview already handles — since PDF/docx text
 * extraction would need a real parser dependency this feature doesn't
 * warrant yet. Ownership-checked the same way every other file action is.
 */
export async function loadFileContext(fileId: string, identity: Identity): Promise<FileContextResult | null> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.status !== "COMMITTED" || !ownsFile(file, identity)) return null;

  if (previewKind(file.mimeType) !== "text") {
    return { name: file.originalName, error: "not a text file — only plain text/code files can be attached today" };
  }

  try {
    const buffer = await readFile(resolveStoragePath(file.storageKey));
    if (buffer.byteLength > MAX_CONTEXT_BYTES) {
      return { name: file.originalName, content: buffer.subarray(0, MAX_CONTEXT_BYTES).toString("utf-8") + "\n...[truncated]" };
    }
    return { name: file.originalName, content: buffer.toString("utf-8") };
  } catch {
    return { name: file.originalName, error: "couldn't read this file" };
  }
}
