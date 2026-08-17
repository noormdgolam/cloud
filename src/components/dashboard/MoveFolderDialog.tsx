"use client";

import { moveFolder } from "@/lib/actions/folder-actions";
import { FolderPickerDialog } from "./FolderPickerDialog";

export function MoveFolderDialog({
  folderId,
  currentParentId,
  open,
  onOpenChange,
}: {
  folderId: string;
  currentParentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FolderPickerDialog
      title="Move to..."
      currentFolderId={currentParentId}
      folderIdForMove={folderId}
      emptyText="No other folders to move into."
      open={open}
      onOpenChange={onOpenChange}
      onSelect={(targetFolderId) => moveFolder(folderId, targetFolderId)}
    />
  );
}

