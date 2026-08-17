"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Italic, UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight, Palette, PaintBucket, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { replaceFileContent } from "@/lib/client-replace";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Align = "left" | "center" | "right";
type CellData = {
  value: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  fill?: string;
  align?: Align;
};
type SheetData = { name: string; rows: CellData[][] };
type Selected = { sheet: number; row: number; col: number };

const EXTRA_ROWS = 5;
const EXTRA_COLS = 3;
const TEXT_COLORS = ["#1a1a1a", "#dc2626", "#2563eb", "#16a34a", "#7c3aed"];
const FILL_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e5e7eb"];

function colLetter(n: number): string {
  let s = "";
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function argbToHex(argb: string | undefined): string | undefined {
  if (!argb || argb.length < 8) return undefined;
  return `#${argb.slice(2)}`;
}

function hexToArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

function inferCellValue(text: string): string | number {
  if (text.trim() === "") return "";
  const num = Number(text);
  return Number.isNaN(num) ? text : num;
}

function emptyCell(): CellData {
  return { value: "" };
}

export function XlsxEditorDialog({
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
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSheets(null);
    setActiveSheet(0);
    setSelected(null);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/files/${fileId}/download?inline=1`);
        if (!res.ok) throw new Error("fetch failed");
        const buffer = await res.arrayBuffer();
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        // ExcelJS's Node-oriented types expect a Buffer; its browser build
        // actually accepts an ArrayBuffer/Uint8Array fine at runtime.
        await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
        if (cancelled) return;

        const loaded: SheetData[] = workbook.worksheets.map((ws) => {
          const rowCount = Math.max(ws.actualRowCount, 1) + EXTRA_ROWS;
          const colCount = Math.max(ws.actualColumnCount, 1) + EXTRA_COLS;
          const rows: CellData[][] = [];
          for (let r = 1; r <= rowCount; r++) {
            const row: CellData[] = [];
            for (let c = 1; c <= colCount; c++) {
              const cell = ws.getCell(r, c);
              const fill = cell.fill;
              row.push({
                value: cell.value == null ? "" : String(cell.text ?? cell.value),
                bold: cell.font?.bold || undefined,
                italic: cell.font?.italic || undefined,
                underline: Boolean(cell.font?.underline) || undefined,
                strike: cell.font?.strike || undefined,
                color: argbToHex(cell.font?.color?.argb),
                fill: fill && fill.type === "pattern" && fill.pattern === "solid" ? argbToHex(fill.fgColor?.argb) : undefined,
                align: (cell.alignment?.horizontal as Align | undefined) ?? undefined,
              });
            }
            rows.push(row);
          }
          return { name: ws.name, rows };
        });
        setSheets(loaded.length > 0 ? loaded : [{ name: "Sheet1", rows: [[emptyCell()]] }]);
      } catch {
        if (!cancelled) setError("Couldn't load this spreadsheet.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  function updateCell(row: number, col: number, patch: Partial<CellData>) {
    setSheets((prev) => {
      if (!prev) return prev;
      const next = prev.map((s, i) => (i === activeSheet ? { ...s, rows: s.rows.map((r) => [...r]) } : s));
      next[activeSheet].rows[row][col] = { ...next[activeSheet].rows[row][col], ...patch };
      return next;
    });
  }

  function toggleSelected(patch: Partial<CellData> | ((c: CellData) => Partial<CellData>)) {
    if (!selected) return;
    const current = sheets?.[selected.sheet].rows[selected.row][selected.col];
    if (!current) return;
    updateCell(selected.row, selected.col, typeof patch === "function" ? patch(current) : patch);
  }

  function addRow() {
    setSheets((prev) => {
      if (!prev) return prev;
      const next = prev.map((s, i) => (i === activeSheet ? { ...s, rows: [...s.rows, Array.from({ length: s.rows[0]?.length ?? 1 }, emptyCell)] } : s));
      return next;
    });
  }

  function addColumn() {
    setSheets((prev) => {
      if (!prev) return prev;
      const next = prev.map((s, i) => (i === activeSheet ? { ...s, rows: s.rows.map((r) => [...r, emptyCell()]) } : s));
      return next;
    });
  }

  async function handleSave() {
    if (!sheets) return;
    setSaving(true);
    setError(null);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      for (const sheet of sheets) {
        const ws = workbook.addWorksheet(sheet.name);
        sheet.rows.forEach((row, r) => {
          row.forEach((cellData, c) => {
            const hasContent = cellData.value !== "" || cellData.bold || cellData.italic || cellData.fill || cellData.color;
            if (!hasContent) return;
            const cell = ws.getCell(r + 1, c + 1);
            cell.value = inferCellValue(cellData.value);
            cell.font = {
              bold: cellData.bold,
              italic: cellData.italic,
              underline: cellData.underline,
              strike: cellData.strike,
              color: cellData.color ? { argb: hexToArgb(cellData.color) } : undefined,
            };
            if (cellData.fill) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(cellData.fill) } };
            }
            if (cellData.align) cell.alignment = { horizontal: cellData.align };
          });
        });
      }
      const buffer = await workbook.xlsx.writeBuffer();
      await replaceFileContent(fileId, new Uint8Array(buffer), XLSX_MIME, fileName);
      router.refresh();
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const sheet = sheets?.[activeSheet];
  const selectedCell = selected ? sheets?.[selected.sheet].rows[selected.row][selected.col] : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Edit ${fileName}`}
        className="fixed left-0 top-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none p-4 sm:p-6"
      >
        {!sheets ? (
          <p className="p-10 text-center text-sm text-ink-faint">{error ?? "Loading…"}</p>
        ) : (
          <>
            {sheets.length > 1 && (
              <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
                {sheets.map((s, i) => (
                  <button
                    key={s.name + i}
                    type="button"
                    onClick={() => {
                      setActiveSheet(i);
                      setSelected(null);
                    }}
                    className={cn("rounded-full border px-3 py-1 text-xs", activeSheet === i ? "border-accent text-accent" : "border-border text-ink-muted")}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-bg-2 p-1.5">
              <button
                type="button"
                title="Bold"
                disabled={!selected}
                onClick={() => toggleSelected((c) => ({ bold: !c.bold }))}
                className={cn("rounded-lg p-1.5 text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-40", selectedCell?.bold && "bg-accent/15 text-accent")}
              >
                <Bold className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                title="Italic"
                disabled={!selected}
                onClick={() => toggleSelected((c) => ({ italic: !c.italic }))}
                className={cn("rounded-lg p-1.5 text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-40", selectedCell?.italic && "bg-accent/15 text-accent")}
              >
                <Italic className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                title="Underline"
                disabled={!selected}
                onClick={() => toggleSelected((c) => ({ underline: !c.underline }))}
                className={cn("rounded-lg p-1.5 text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-40", selectedCell?.underline && "bg-accent/15 text-accent")}
              >
                <UnderlineIcon className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                title="Strikethrough"
                disabled={!selected}
                onClick={() => toggleSelected((c) => ({ strike: !c.strike }))}
                className={cn("rounded-lg p-1.5 text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-40", selectedCell?.strike && "bg-accent/15 text-accent")}
              >
                <Strikethrough className="size-4" aria-hidden />
              </button>

              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              {(["left", "center", "right"] as const).map((a) => {
                const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                return (
                  <button
                    key={a}
                    type="button"
                    title={`Align ${a}`}
                    disabled={!selected}
                    onClick={() => toggleSelected({ align: a })}
                    className={cn("rounded-lg p-1.5 text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-40", selectedCell?.align === a && "bg-accent/15 text-accent")}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                );
              })}

              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <div className="flex items-center gap-1">
                <Palette className="size-3.5 text-ink-faint" aria-hidden />
                {TEXT_COLORS.map((c) => (
                  <button key={c} type="button" disabled={!selected} onClick={() => toggleSelected({ color: c })} className="size-4 rounded-full border border-border-strong disabled:opacity-40" style={{ backgroundColor: c }} title={c} />
                ))}
              </div>
              <div className="ml-2 flex items-center gap-1">
                <PaintBucket className="size-3.5 text-ink-faint" aria-hidden />
                {FILL_COLORS.map((c) => (
                  <button key={c} type="button" disabled={!selected} onClick={() => toggleSelected({ fill: c })} className="size-4 rounded-full border border-border-strong disabled:opacity-40" style={{ backgroundColor: c }} title={c} />
                ))}
              </div>

              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <button type="button" onClick={addRow} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink">
                <Plus className="size-3.5" aria-hidden /> Row
              </button>
              <button type="button" onClick={addColumn} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink">
                <Plus className="size-3.5" aria-hidden /> Column
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-white">
              <table className="border-collapse text-sm text-ink">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 w-10 border border-border bg-bg-2" />
                    {sheet?.rows[0]?.map((_, c) => (
                      <th key={c} className="sticky top-0 z-10 min-w-20 border border-border bg-bg-2 px-2 py-1 text-xs font-medium text-ink-muted">
                        {colLetter(c + 1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet?.rows.map((row, r) => (
                    <tr key={r}>
                      <td className="sticky left-0 z-10 border border-border bg-bg-2 px-2 py-1 text-center text-xs text-ink-muted">{r + 1}</td>
                      {row.map((cell, c) => (
                        <td key={c} className="border border-border p-0">
                          <input
                            value={cell.value}
                            onFocus={() => setSelected({ sheet: activeSheet, row: r, col: c })}
                            onChange={(e) => updateCell(r, c, { value: e.target.value })}
                            style={{
                              fontWeight: cell.bold ? 700 : 400,
                              fontStyle: cell.italic ? "italic" : "normal",
                              textDecoration: [cell.underline && "underline", cell.strike && "line-through"].filter(Boolean).join(" ") || "none",
                              color: cell.color ?? undefined,
                              backgroundColor: cell.fill ?? (selected?.row === r && selected?.col === c ? "var(--glass-surface)" : undefined),
                              textAlign: cell.align ?? "left",
                            }}
                            className="w-full min-w-20 bg-transparent px-2 py-1 outline-none focus:ring-1 focus:ring-accent"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="button" variant="accent" className="w-full" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
