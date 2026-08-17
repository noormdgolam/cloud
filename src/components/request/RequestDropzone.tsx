"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, UploadCloud, XCircle } from "lucide-react";
import { Input, Label } from "@/components/ui/Input";
import { formatBytes } from "@/lib/format";

type Task = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

function uploadOne(token: string, name: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `/api/requests/${token}/upload${name ? `?name=${encodeURIComponent(name)}` : ""}`;
    xhr.open("POST", url);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        try {
          reject(new Error(JSON.parse(xhr.responseText).error ?? `Upload failed (${xhr.status}).`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status}).`));
        }
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export function RequestDropzone({ token, remaining }: { token: string; remaining: number | null }) {
  const [name, setName] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const full = remaining !== null && remaining <= 0;

  const startUploads = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0 || full) return;

      const newTasks: Task[] = list.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "uploading",
      }));
      setTasks((prev) => [...prev, ...newTasks]);

      list.forEach((file, i) => {
        const taskId = newTasks[i].id;
        uploadOne(token, name, file, (pct) => {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress: pct } : t)));
        })
          .then(() => setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "done", progress: 100 } : t))))
          .catch((err) =>
            setTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, status: "error", error: err.message } : t))
            )
          );
      });
    },
    [token, name, full]
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="uploaderName">Your name (optional)</Label>
        <Input
          id="uploaderName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="So they know who sent it"
          maxLength={191}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          startUploads(e.dataTransfer.files);
        }}
        onClick={() => !full && inputRef.current?.click()}
        className={`glass flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          full ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        } ${dragActive ? "border-accent" : "border-border-strong"}`}
      >
        <UploadCloud className="size-6 text-ink-faint" strokeWidth={1.75} aria-hidden />
        <p className="text-sm text-ink">{full ? "This request has received its file limit." : "Drop files here, or click to choose"}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={full}
          onChange={(e) => {
            if (e.target.files) startUploads(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {tasks.length > 0 && (
        <div className="glass flex flex-col gap-2 rounded-2xl p-3">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 text-sm">
              {t.status === "done" ? (
                <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden />
              ) : t.status === "error" ? (
                <XCircle className="size-4 shrink-0 text-danger" aria-hidden />
              ) : (
                <span className="size-4 shrink-0 animate-pulse rounded-full bg-accent/40" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-ink">{t.name}</span>
              <span className="shrink-0 font-mono text-xs text-ink-faint">
                {t.status === "error" ? t.error : t.status === "done" ? formatBytes(BigInt(t.size)) : `${t.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
