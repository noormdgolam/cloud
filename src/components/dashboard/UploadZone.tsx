"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatBytes } from "@/lib/format";
import { uploadFile } from "@/lib/client-upload";
import { GoogleImportButton } from "./GoogleImportButton";

type UploadTask = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

export function UploadZone({
  folderId,
  headerLeft,
  toolbarExtra,
  googleImportEligible = false,
  children,
}: {
  folderId: string | null;
  headerLeft?: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  googleImportEligible?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const startUploads = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const newTasks: UploadTask[] = list.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "uploading",
      }));
      setTasks((prev) => [...prev, ...newTasks]);

      list.forEach((file, i) => {
        const taskId = newTasks[i].id;
        uploadFile(file, folderId, (pct) => {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress: pct } : t)));
        })
          .then(() => {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "done", progress: 100 } : t)));
            router.refresh();
            setTimeout(() => {
              setTasks((prev) => prev.filter((t) => t.id !== taskId));
            }, 2000);
          })
          .catch((error: Error) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, status: "error", error: error.message } : t))
            );
          });
      });
    },
    [folderId, router]
  );

  return (
    <div
      className="relative"
      data-mcp-action="upload_file"
      data-mcp-param-folder-id={folderId ?? "root"}
      data-mcp-description="Upload single or multiple files to Bongshai Cloud storage"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files.length > 0) startUploads(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) startUploads(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {headerLeft}
        <div className="flex flex-wrap items-center gap-2">
          {toolbarExtra}
          {googleImportEligible && <GoogleImportButton onFilesReady={startUploads} />}
          <Button
            type="button"
            variant="accent"
            className="px-4 py-2 text-sm"
            data-mcp-action="trigger_upload_dialog"
            data-mcp-description="Open file selector dialog for uploading files"
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="size-4" aria-hidden />
            Upload
          </Button>
        </div>
      </div>

      {children}

      {tasks.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 flex w-72 flex-col gap-2">
          {tasks.map((task) => (
            <div key={task.id} className="glass rounded-xl p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-ink">{task.name}</span>
                <span className="shrink-0 font-mono text-[0.7rem] text-ink-faint">
                  {formatBytes(task.size)}
                </span>
              </div>
              {task.status === "error" ? (
                <p className="text-xs text-danger">{task.error}</p>
              ) : (
                <div className="h-1 overflow-hidden rounded-full bg-bg-2">
                  <div
                    className={
                      task.status === "done"
                        ? "h-full rounded-full bg-success transition-all"
                        : "h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all"
                    }
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-bg-1/80 backdrop-blur-sm">
          <div className="glass flex flex-col items-center gap-3 rounded-2xl px-10 py-12">
            <UploadCloud className="size-8 text-accent" aria-hidden />
            <p className="text-sm text-ink">Drop to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}
