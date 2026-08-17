import "server-only";
import mammoth from "mammoth";
import { PdfTextWriter } from "./pdf-text-writer";
import { parseBlocks } from "./html-blocks";

/**
 * Renders a .docx to PDF entirely locally — mammoth extracts the document's
 * structure as HTML, then PdfTextWriter lays it out as a real paginated PDF.
 * No external API, no system binary (LibreOffice etc.) — both dependencies
 * are pure-JS and already used elsewhere in this app (OfficePreview.tsx).
 * Reproduces reading order, headings, paragraphs, bold/italic, and lists;
 * does not attempt exact Word layout (fonts, margins, tables-as-grids,
 * images) — see html-blocks.ts's fallback for how unsupported content
 * (tables etc.) still contributes its text rather than being dropped.
 */
export async function docxToPdf(buffer: Buffer): Promise<Buffer> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const blocks = parseBlocks(html);

  const writer = await PdfTextWriter.create();
  for (const block of blocks) {
    if (block.kind === "heading") writer.addHeading(block.runs.map((r) => r.text).join(""), block.level, block.align);
    else if (block.kind === "paragraph") writer.addParagraph(block.runs, block.align);
    else writer.addListItem(block.runs, block.ordered, block.index, block.indentLevel, block.align);
  }

  return Buffer.from(await writer.save());
}
