"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { FilePickerDialog } from "@/components/dashboard/FilePickerDialog";
import type { PickerFile } from "@/lib/actions/file-actions";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content: "Hi! Ask me anything about Bongshai Cloud — plans, storage, tools, sharing. You can also attach one of your text files and ask about it.",
};

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState<PickerFile | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          fileId: attached?.id ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong.");
      }
      const { reply } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the assistant.");
    } finally {
      setBusy(false);
      setAttached(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="glass fixed bottom-5 right-5 z-50 flex size-[3.25rem] items-center justify-center rounded-full text-accent shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-transform hover:scale-105"
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
      </button>

      {open && (
        <div
          className="glass fixed bottom-[4.75rem] right-5 z-50 flex h-[32rem] max-h-[75vh] w-[calc(100%-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          role="dialog"
          aria-label="Assistant chat"
          data-mcp-action="query_support_assistant"
          data-mcp-endpoint="/api/assistant/chat"
          data-mcp-description="Ask questions about storage plans, features, or attach text files for analysis"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-ink">Bongshai Assistant</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "self-end rounded-br-sm bg-accent text-white"
                    : "self-start rounded-bl-sm bg-bg-2 text-ink"
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="self-start rounded-2xl rounded-bl-sm bg-bg-2 px-3.5 py-2 text-sm text-ink-faint">
                Thinking…
              </div>
            )}
            {error && <p className="self-start px-1 text-xs text-danger">{error}</p>}
          </div>

          {attached && (
            <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-xs text-ink-muted">
              <Paperclip className="size-3 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{attached.name}</span>
              <button type="button" onClick={() => setAttached(null)} className="shrink-0 text-ink-faint hover:text-ink">
                <X className="size-3" aria-hidden />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1.5 border-t border-border p-2.5">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              title="Attach a text file"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-ink"
            >
              <Paperclip className="size-4" aria-hidden />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a question…"
              rows={1}
              className="max-h-24 min-h-9 flex-1 resize-none rounded-xl border border-border bg-bg-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || input.trim().length === 0}
              title="Send"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40"
            >
              <Send className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <FilePickerDialog
        title="Attach a text file"
        accept={(m) => m.startsWith("text/") || m === "application/json"}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(files) => setAttached(files[0] ?? null)}
      />
    </>
  );
}
