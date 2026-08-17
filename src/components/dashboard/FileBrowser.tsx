import { Download, FolderOpen } from "lucide-react";
import type { BreadcrumbEntry, FileScanStatus, SortOption } from "@/lib/data/browser";
import { Breadcrumb } from "./Breadcrumb";
import { FolderCard } from "./FolderCard";
import { SelectableFileList } from "./SelectableFileList";
import { NewFolderDialog } from "./NewFolderDialog";
import { SortSelect } from "./SortSelect";
import { UploadZone } from "./UploadZone";
import { LinkButton } from "@/components/ui/Button";

type FolderSummary = { id: string; name: string };
type FileSummary = {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
  createdAt: Date;
  isDuplicate: boolean;
  scanStatus: FileScanStatus;
};

export function FileBrowser({
  parentId,
  breadcrumbs,
  folders,
  files,
  sort,
  googleImportEligible = false,
}: {
  parentId: string | null;
  breadcrumbs: BreadcrumbEntry[];
  folders: FolderSummary[];
  files: FileSummary[];
  sort: SortOption;
  googleImportEligible?: boolean;
}) {
  const isEmpty = folders.length === 0 && files.length === 0;
  const basePath = parentId ? `/folder/${parentId}` : "/dashboard";

  return (
    <UploadZone
      folderId={parentId}
      googleImportEligible={googleImportEligible}
      headerLeft={<Breadcrumb entries={breadcrumbs} />}
      toolbarExtra={
        <>
          {files.length > 1 && <SortSelect basePath={basePath} sort={sort} />}
          {parentId && !isEmpty && (
            <LinkButton
              href={`/api/files/zip?folderId=${parentId}`}
              variant="ghost"
              className="px-4 py-2 text-xs"
              title="Download this folder as a zip"
            >
              <Download className="size-3.5" aria-hidden />
              Download folder
            </LinkButton>
          )}
          <NewFolderDialog parentId={parentId} />
        </>
      }
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
                <FolderCard key={folder.id} id={folder.id} name={folder.name} parentId={parentId} />
              ))}
            </div>
          )}

          {files.length > 0 && <SelectableFileList files={files} parentId={parentId} />}
        </div>
      )}
    </UploadZone>
  );
}
