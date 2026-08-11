import { FolderOpen } from "lucide-react";
import type { BreadcrumbEntry } from "@/lib/data/browser";
import { Breadcrumb } from "./Breadcrumb";
import { FolderCard } from "./FolderCard";
import { FileRow } from "./FileRow";
import { NewFolderDialog } from "./NewFolderDialog";
import { UploadZone } from "./UploadZone";

type FolderSummary = { id: string; name: string };
type FileSummary = {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
  createdAt: Date;
};

export function FileBrowser({
  parentId,
  breadcrumbs,
  folders,
  files,
}: {
  parentId: string | null;
  breadcrumbs: BreadcrumbEntry[];
  folders: FolderSummary[];
  files: FileSummary[];
}) {
  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <UploadZone
      folderId={parentId}
      headerLeft={<Breadcrumb entries={breadcrumbs} />}
      toolbarExtra={<NewFolderDialog parentId={parentId} />}
    >
      {isEmpty ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-full border border-border bg-bg-2">
            <FolderOpen className="size-5 text-ink-faint" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="text-sm text-ink-muted">
            Nothing here yet. Drop a file, or create a folder to get organized.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {folders.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map((folder) => (
                <FolderCard key={folder.id} id={folder.id} name={folder.name} />
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="glass flex flex-col gap-0.5 rounded-2xl p-2">
              {files.map((file) => (
                <FileRow
                  key={file.id}
                  id={file.id}
                  name={file.originalName}
                  size={file.size}
                  mimeType={file.mimeType}
                  createdAt={file.createdAt}
                  folderId={parentId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </UploadZone>
  );
}
