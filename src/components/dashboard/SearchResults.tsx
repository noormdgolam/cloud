import { Search } from "lucide-react";
import type { SearchResultFile } from "@/lib/data/browser";
import { FileRow } from "./FileRow";

export function SearchResults({ query, results }: { query: string; results: SearchResultFile[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-ink-muted">
        <Search className="size-4" aria-hidden />
        {results.length === 0 ? (
          <span>No files match &ldquo;{query}&rdquo;.</span>
        ) : (
          <span>
            {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="glass flex flex-col gap-0.5 rounded-2xl p-2">
          {results.map((file) => (
            <div key={file.id}>
              <p className="px-3.5 pt-2.5 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink-faint">
                {file.folderName ?? "Root"}
              </p>
              <FileRow
                id={file.id}
                name={file.originalName}
                size={file.size}
                mimeType={file.mimeType}
                createdAt={file.createdAt}
                folderId={file.folderId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
