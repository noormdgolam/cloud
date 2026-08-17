"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Link2Off,
  Palette,
  Highlighter,
  RemoveFormatting,
  Info,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { FontSize } from "@/lib/tiptap/font-size";
import { parseBlocks } from "@/lib/convert/html-blocks";
import { blocksToDocx } from "@/lib/convert/docx-writer";
import { replaceFileContent } from "@/lib/client-replace";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Every mark/node here maps onto a field html-blocks.ts's parser reads and
// docx-writer.ts's Run/Block model can actually round-trip on save (see
// both files) — bold, italic, underline, strike, color, highlight, font
// size, heading levels, alignment, links, bullet/numbered lists. Tables,
// images, custom fonts, and nested-list indent are NOT wired end-to-end yet
// (the save pipeline would silently drop them), so their toolbar buttons
// are deliberately absent rather than offered and broken.
const EXTENSIONS = [
  StarterKit.configure({ blockquote: false, code: false, codeBlock: false, horizontalRule: false }),
  TextStyle,
  Color,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 24, 30, 36];
const TEXT_COLORS = ["#1a1a1a", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];
const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"];

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        "rounded-lg p-1.5 text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink",
        active && "bg-accent/15 text-accent"
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

function ColorSwatchPicker({
  colors,
  onPick,
  icon: Icon,
  label,
}: {
  colors: string[];
  onPick: (color: string) => void;
  icon: typeof Palette;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <ToolbarButton icon={Icon} label={label} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-lg border border-border bg-bg-1 p-1.5 shadow-lg">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="size-5 rounded-full border border-border-strong"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-bg-2 p-1.5">
      <select
        value={editor.isActive("heading", { level: 1 }) ? "1" : editor.isActive("heading", { level: 2 }) ? "2" : editor.isActive("heading", { level: 3 }) ? "3" : "0"}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
        }}
        className="rounded-lg border border-border bg-bg-2 px-2 py-1 text-xs text-ink"
      >
        <option value="0">Normal text</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <select
        value={String((editor.getAttributes("textStyle").fontSize as string | undefined)?.replace("pt", "") ?? "")}
        onChange={(e) => {
          if (!e.target.value) editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(`${e.target.value}pt`).run();
        }}
        className="ml-1 rounded-lg border border-border bg-bg-2 px-2 py-1 text-xs text-ink"
        title="Font size"
      >
        <option value="">Size</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <Divider />
      <ToolbarButton icon={Bold} label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton icon={Italic} label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton
        icon={UnderlineIcon}
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <Divider />
      <ColorSwatchPicker
        icon={Palette}
        label="Text color"
        colors={TEXT_COLORS}
        onPick={(c) => editor.chain().focus().setColor(c).run()}
      />
      <ColorSwatchPicker
        icon={Highlighter}
        label="Highlight"
        colors={HIGHLIGHT_COLORS}
        onPick={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
      />

      <Divider />
      <ToolbarButton icon={AlignLeft} label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
      <ToolbarButton icon={AlignCenter} label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
      <ToolbarButton icon={AlignRight} label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
      <ToolbarButton icon={AlignJustify} label="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} />

      <Divider />
      <ToolbarButton icon={List} label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton icon={ListOrdered} label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />

      <Divider />
      <ToolbarButton
        icon={Link2}
        label="Add link"
        active={editor.isActive("link")}
        onClick={() => {
          const url = window.prompt("Link URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
      />
      <ToolbarButton icon={Link2Off} label="Remove link" onClick={() => editor.chain().focus().unsetLink().run()} />
      <ToolbarButton icon={RemoveFormatting} label="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
    </div>
  );
}

export function DocxEditorDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
  onSaved,
}: {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "docx-editor min-h-full bg-white p-8 text-sm text-ink focus:outline-none" },
    },
  });

  useEffect(() => {
    if (!open || !editor) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/files/${fileId}/download?inline=1`);
        if (!res.ok) throw new Error("fetch failed");
        const buffer = await res.arrayBuffer();
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (cancelled) return;
        editor.commands.setContent(result.value);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Couldn't load this document.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, fileId, editor]);

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const html = editor.getHTML();
      const blocks = parseBlocks(html);
      const blob = await blocksToDocx(blocks);
      await replaceFileContent(fileId, blob, DOCX_MIME, fileName);
      router.refresh();
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Edit ${fileName}`}
        className="fixed left-0 top-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none p-4 sm:p-6"
      >
        <div className="flex items-start gap-2 rounded-xl border border-border-strong bg-bg-2 px-3 py-2 text-xs text-ink-faint">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Saved files keep everything you apply here — bold, color, size, alignment, links — real Word formatting,
            confirmed in the file itself. Tables, images, and custom fonts aren&apos;t supported and lose their
            formatting on save. One current gap: re-opening a file here shows bold/italic/lists correctly, but color
            and font size you set previously won&apos;t show in this editor (though they&apos;re still in the file —
            open it in Word, or download it, and they&apos;re there).
          </span>
        </div>

        {editor && !loading && <Toolbar editor={editor} />}

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
          {loading ? (
            <p className="p-10 text-center text-sm text-ink-faint">{error ?? "Loading…"}</p>
          ) : (
            <EditorContent editor={editor} className="h-full" />
          )}
        </div>

        {error && !loading && <p className="text-xs text-danger">{error}</p>}

        <Button type="button" variant="accent" className="w-full" disabled={saving || loading} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
