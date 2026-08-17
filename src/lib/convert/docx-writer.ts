"use client";

import { Document, Paragraph, TextRun, ExternalHyperlink, HeadingLevel, AlignmentType, HighlightColor, Packer, type ParagraphChild } from "docx";
import type { Block } from "./html-blocks";
import type { Align, Run } from "./pdf-text-writer";

const HEADING_BY_LEVEL: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

const ALIGN_BY_VALUE: Record<Align, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

// Word's own highlight feature is a fixed named palette, not arbitrary RGB —
// this is a real constraint of the .docx format, not a shortcut taken here.
// Map an arbitrary hex color (from a color-picker input) to its nearest
// palette entry by Euclidean RGB distance.
type HighlightColorValue = (typeof HighlightColor)[keyof typeof HighlightColor];

const HIGHLIGHT_RGB: [HighlightColorValue, number, number, number][] = [
  [HighlightColor.BLACK, 0, 0, 0],
  [HighlightColor.BLUE, 0, 0, 255],
  [HighlightColor.CYAN, 0, 255, 255],
  [HighlightColor.DARK_BLUE, 0, 0, 139],
  [HighlightColor.DARK_CYAN, 0, 139, 139],
  [HighlightColor.DARK_GRAY, 169, 169, 169],
  [HighlightColor.DARK_GREEN, 0, 100, 0],
  [HighlightColor.DARK_MAGENTA, 139, 0, 139],
  [HighlightColor.DARK_RED, 139, 0, 0],
  [HighlightColor.DARK_YELLOW, 128, 128, 0],
  [HighlightColor.GREEN, 0, 255, 0],
  [HighlightColor.LIGHT_GRAY, 211, 211, 211],
  [HighlightColor.MAGENTA, 255, 0, 255],
  [HighlightColor.RED, 255, 0, 0],
  [HighlightColor.WHITE, 255, 255, 255],
  [HighlightColor.YELLOW, 255, 255, 0],
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function nearestHighlight(hex: string): HighlightColorValue {
  const [r, g, b] = hexToRgb(hex);
  let best = HIGHLIGHT_RGB[0];
  let bestDist = Infinity;
  for (const entry of HIGHLIGHT_RGB) {
    const [, er, eg, eb] = entry;
    const dist = (r - er) ** 2 + (g - eg) ** 2 + (b - eb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best[0];
}

function runToChild(r: Run): ParagraphChild {
  const textRun = new TextRun({
    text: r.text,
    bold: r.bold,
    italics: r.italic,
    underline: r.underline ? {} : undefined,
    strike: r.strike,
    color: r.color?.replace("#", ""),
    highlight: r.highlight ? nearestHighlight(r.highlight) : undefined,
    size: r.fontSize ? Math.round(r.fontSize * 2) : undefined, // docx sizes are in half-points
  });
  return r.href ? new ExternalHyperlink({ link: r.href, children: [textRun] }) : textRun;
}

function runsToChildren(runs: Run[]): ParagraphChild[] {
  // Every run becomes its own TextRun rather than merging adjacent
  // same-formatting runs — more XML nodes than strictly necessary, but
  // simpler and still produces a fully valid, correctly-formatted document.
  return runs.map(runToChild);
}

/**
 * Turns the same Block[] model pdf-text-writer.ts renders as a PDF into a
 * real, valid .docx — bold/italic/underline/strike/color/highlight/size,
 * paragraph alignment, links, and list markers. Lists use real Word literal
 * "N."/"•" markers rather than a custom numbering config, matching
 * PdfTextWriter's own addListItem precedent.
 */
export async function blocksToDocx(blocks: Block[]): Promise<Blob> {
  const paragraphs = blocks.map((block) => {
    if (block.kind === "heading") {
      return new Paragraph({
        heading: HEADING_BY_LEVEL[block.level] ?? HeadingLevel.HEADING_6,
        alignment: block.align ? ALIGN_BY_VALUE[block.align] : undefined,
        children: runsToChildren(block.runs),
      });
    }
    if (block.kind === "listitem") {
      const marker = block.ordered ? `${block.index}. ` : "• ";
      const indentLevel = block.indentLevel ?? 0;
      return new Paragraph({
        indent: indentLevel > 0 ? { left: indentLevel * 720 } : undefined,
        alignment: block.align ? ALIGN_BY_VALUE[block.align] : undefined,
        children: [new TextRun({ text: marker }), ...runsToChildren(block.runs)],
      });
    }
    return new Paragraph({
      alignment: block.align ? ALIGN_BY_VALUE[block.align] : undefined,
      children: runsToChildren(block.runs),
    });
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}
