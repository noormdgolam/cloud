"use client";

import { useEffect, useState } from "react";

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024; // 2MB — highlighting a huge file client-side would freeze the tab

export function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<{ html: string } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");

        const blob = await res.blob();
        if (blob.size > MAX_PREVIEW_BYTES) {
          if (!cancelled) setState({ error: "File is too large to preview inline. Download it instead." });
          return;
        }

        const text = await blob.text();
        const hljs = (await import("highlight.js")).default;
        const highlighted = hljs.highlightAuto(text).value;
        if (!cancelled) setState({ html: highlighted });
      } catch {
        if (!cancelled) setState({ error: "Couldn't load a preview for this file." });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!state) {
    return <p className="p-6 text-sm text-ink-faint">Loading preview…</p>;
  }
  if ("error" in state) {
    return <p className="p-6 text-sm text-ink-faint">{state.error}</p>;
  }

  return (
    <pre className="hljs w-full overflow-auto p-4 text-left text-xs leading-relaxed">
      <code dangerouslySetInnerHTML={{ __html: state.html }} />
    </pre>
  );
}
