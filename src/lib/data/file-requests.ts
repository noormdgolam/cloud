import { prisma } from "@/lib/prisma";

export type FileRequestListItem = {
  id: string;
  token: string;
  title: string;
  fileCount: number;
  maxFiles: number | null;
  expiresAt: Date | null;
  revoked: boolean;
  createdAt: Date;
};

export async function getFileRequestsForUser(userId: string): Promise<FileRequestListItem[]> {
  return prisma.fileRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      title: true,
      fileCount: true,
      maxFiles: true,
      expiresAt: true,
      revoked: true,
      createdAt: true,
    },
  });
}

export type PublicFileRequest = {
  id: string;
  title: string;
  message: string | null;
  fileCount: number;
  maxFiles: number | null;
  requesterName: string | null;
};

export type FileRequestLookup =
  | { status: "ok"; request: PublicFileRequest }
  | { status: "not_found" }
  | { status: "revoked" }
  | { status: "expired" }
  | { status: "full" };

export async function lookupFileRequest(token: string): Promise<FileRequestLookup> {
  const request = await prisma.fileRequest.findUnique({
    where: { token },
    include: { user: { select: { name: true } } },
  });
  if (!request) return { status: "not_found" };
  if (request.revoked) return { status: "revoked" };
  if (request.expiresAt && request.expiresAt < new Date()) return { status: "expired" };
  if (request.maxFiles !== null && request.fileCount >= request.maxFiles) return { status: "full" };

  return {
    status: "ok",
    request: {
      id: request.id,
      title: request.title,
      message: request.message,
      fileCount: request.fileCount,
      maxFiles: request.maxFiles,
      requesterName: request.user.name,
    },
  };
}
