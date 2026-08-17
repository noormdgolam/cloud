"use client";

import { moveFile } from "@/lib/actions/file-actions";
import { FolderPickerDialog } from "./FolderPickerDialog";

export function MoveFileDialog({
  fileId,
  currentFolderId,
  open,
  onOpenChange,
}: {
  fileId: string;
  currentFolderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FolderPickerDialog
      currentFolderId={currentFolderId}
      open={open}
      onOpenChange={onOpenChange}
      onSelect={(target) => moveFile(fileId, target)}
    />
  );
}
