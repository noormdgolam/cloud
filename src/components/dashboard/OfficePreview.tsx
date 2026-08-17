"use client";

import { useEffect, useState } from "react";

type Kind = "docx" | "xlsx";

export function OfficePreview({ url, kind }: { url: string; kind: Kind }) {
  const [state, setState] = useState<{ html: string } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");
        const buffer = await res.arrayBuffer();

        const rawHtml = kind === "docx" ? await renderDocx(buffer) : await renderXlsx(buffer);

        // Both converters run against attacker-controllable input (a user
        // can upload any .docx/.xlsx). mammoth in particular can carry
        // through hyperlink hrefs from the source document verbatim (e.g. a
        // crafted javascript: URL) — sanitize before this hits
        // dangerouslySetInnerHTML rather than trusting the converters'
        // output is inherently safe.
        const DOMPurify = (await import("dompurify")).default;
        const html = DOMPurify.sanitize(rawHtml);

        if (!cancelled) setState({ html });
      } catch {
        if (!cancelled) setState({ error: "Couldn't load a preview for this file." });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [url, kind]);

  if (!state) {
    return <p className="p-6 text-sm text-ink-faint">Loading preview…</p>;
  }
  if ("error" in state) {
    return <p className="p-6 text-sm text-ink-faint">{state.error}</p>;
  }

  return (
    <div
      className="office-preview w-full overflow-auto bg-white p-6 text-left text-sm text-ink"
      dangerouslySetInnerHTML={{ __html: state.html }}
    />
  );
}

async function renderDocx(buffer: ArrayBuffer): Promise<string> {
  // mammoth's package.json "browser" field swaps its two Node-specific
  // submodules (unzip, docx/files) for browser-compatible ones automatically
  // when bundled — plain import, no separate browser entry point needed.
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return result.value;
}

async function renderXlsx(buffer: ArrayBuffer): Promise<string> {
  // SheetJS's own arbitrary-code-can-load-arbitrary-formula-functions
  // surface isn't invoked here — this only ever calls sheet_to_html on data
  // already parsed by XLSX.read, no eval-like APIs touched.
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets = workbook.SheetNames.map((name: string) => {
    const sheet = workbook.Sheets[name];
    const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
    return `<h3 class="office-sheet-title">${escapeHtml(name)}</h3>${html}`;
  });
  return sheets.join("<hr />");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
