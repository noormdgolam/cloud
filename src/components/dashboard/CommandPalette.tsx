"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { File, Folder, FolderOpen, Moon, Search, Settings, Trash2, Upload } from "lucide-react";
import { searchForPalette, type PaletteFile, type PaletteFolder } from "@/lib/actions/search-actions";

const NAV_ITEMS = [
  { label: "My files", href: "/dashboard", icon: FolderOpen },
  { label: "Trash", href: "/trash", icon: Trash2 },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Upload without an account", href: "/upload", icon: Upload },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fetchedResults, setFetchedResults] = useState<{ files: PaletteFile[]; folders: PaletteFolder[] }>({
    files: [],
    folders: [],
  });
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const trimmedQuery = query.trim();

  useEffect(() => {
    // No fetch (and no state reset) needed for an empty query — `results`
    // below just falls back to empty directly, derived at render time.
    if (!open || !trimmedQuery) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchForPalette(trimmedQuery).then((r) => {
        if (!cancelled) setFetchedResults(r);
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, open]);

  const results = trimmedQuery ? fetchedResults : { files: [], folders: [] };

  function go(href: string) {
    router.push(href);
    setOpen(false);
    setQuery("");
  }

  function toggleTheme() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (dark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    }
    setOpen(false);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter={false}
      className="fixed left-1/2 top-24 z-[60] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2"
      overlayClassName="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
      contentClassName="glass overflow-hidden rounded-2xl border border-border-strong shadow-2xl"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search files, folders, or jump to a page…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-faint sm:block">
          Esc
        </kbd>
      </div>

      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-ink-faint">
          {query.trim() ? "Nothing found." : "Type to search, or pick an action below."}
        </Command.Empty>

        {results.folders.length > 0 && (
          <Command.Group heading="Folders" className="px-1 pb-1 pt-2 text-xs text-ink-faint [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2">
            {results.folders.map((folder) => (
              <Command.Item
                key={folder.id}
                value={`folder-${folder.id}`}
                onSelect={() => go(`/folder/${folder.id}`)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-[var(--glass-surface-hover)]"
              >
                <Folder className="size-4 text-ink-faint" aria-hidden />
                {folder.name}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {results.files.length > 0 && (
          <Command.Group heading="Files" className="px-1 pb-1 pt-2 text-xs text-ink-faint [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2">
            {results.files.map((file) => (
              <Command.Item
                key={file.id}
                value={`file-${file.id}`}
                onSelect={() => go(file.folderId ? `/folder/${file.folderId}` : "/dashboard")}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-[var(--glass-surface-hover)]"
              >
                <File className="size-4 text-ink-faint" aria-hidden />
                {file.name}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Go to" className="px-1 pb-1 pt-2 text-xs text-ink-faint [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2">
          {NAV_ITEMS.map((item) => (
            <Command.Item
              key={item.href}
              value={`nav-${item.label}`}
              onSelect={() => go(item.href)}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-[var(--glass-surface-hover)]"
            >
              <item.icon className="size-4 text-ink-faint" aria-hidden />
              {item.label}
            </Command.Item>
          ))}
          <Command.Item
            value="toggle-theme"
            onSelect={toggleTheme}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-[var(--glass-surface-hover)]"
          >
            <Moon className="size-4 text-ink-faint" aria-hidden />
            Toggle theme
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
