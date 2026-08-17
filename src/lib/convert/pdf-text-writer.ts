import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_WIDTH = 612; // US Letter, points (72dpi)
const PAGE_HEIGHT = 792;
const MARGIN = 56;

export type Align = "left" | "center" | "right" | "justify";

export type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Hex color, e.g. "#ff0000". */
  color?: string;
  /** Hex highlight/background color. */
  highlight?: string;
  /** Point size override for this run specifically. */
  fontSize?: number;
  /** Link target — not rendered by PdfTextWriter (no clickable-link support
   * in the PDF output), only consumed by docx-writer.ts. */
  href?: string;
};

function hexToColor(hex: string): Color {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(Number.isNaN(r) ? 0.1 : r, Number.isNaN(g) ? 0.1 : g, Number.isNaN(b) ? 0.1 : b);
}

const INK = rgb(0.1, 0.1, 0.12);

/**
 * Minimal paginated text-flow writer for pdf-lib — headings, word-wrapped
 * paragraphs with mixed-formatting runs (bold/italic/underline/strike/
 * color/highlight/size) and simple list items, plus paragraph alignment.
 * Built for rendering mammoth's docx->HTML output (and the docx editor's
 * saved content) as a real PDF entirely locally, so it only needs to look
 * like a readable document, not reproduce Word's exact layout engine.
 */
export class PdfTextWriter {
  private doc: PDFDocument;
  private page!: PDFPage;
  private y = 0;
  private fonts: Record<"regular" | "bold" | "italic" | "boldItalic", PDFFont>;

  private constructor(doc: PDFDocument, fonts: PdfTextWriter["fonts"]) {
    this.doc = doc;
    this.fonts = fonts;
    this.newPage();
  }

  static async create(): Promise<PdfTextWriter> {
    const doc = await PDFDocument.create();
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    };
    return new PdfTextWriter(doc, fonts);
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < MARGIN) this.newPage();
  }

  private fontFor(bold: boolean, italic: boolean): PDFFont {
    if (bold && italic) return this.fonts.boldItalic;
    if (bold) return this.fonts.bold;
    if (italic) return this.fonts.italic;
    return this.fonts.regular;
  }

  private wordsFromRuns(runs: Run[], defaultSize: number): { text: string; run: Run; size: number }[] {
    const words: { text: string; run: Run; size: number }[] = [];
    for (const run of runs) {
      for (const text of run.text.split(/\s+/).filter(Boolean)) {
        words.push({ text, run, size: run.fontSize ?? defaultSize });
      }
    }
    return words;
  }

  /** Word-wraps mixed-formatting runs into lines that fit maxWidth, drawing as it goes. */
  private drawWrapped(
    runs: Run[],
    { fontSize, indent = 0, lineHeight = 1.35, align = "left" }: { fontSize: number; indent?: number; lineHeight?: number; align?: Align }
  ) {
    const words = this.wordsFromRuns(runs, fontSize);
    const maxWidth = PAGE_WIDTH - MARGIN * 2 - indent;
    const lh = fontSize * lineHeight;

    type LineWord = { text: string; run: Run; size: number; font: PDFFont; width: number };
    let line: LineWord[] = [];
    let lineWidth = 0;

    const flushLine = (isLastLine: boolean) => {
      if (line.length === 0) return;
      this.ensureSpace(lh);

      const spaceTotal = line.reduce((s, w) => s + w.width, 0);
      const gapCount = Math.max(1, line.length - 1);
      const naturalSpaceWidth = this.fonts.regular.widthOfTextAtSize(" ", fontSize);
      let startX = MARGIN + indent;
      let gapWidth = naturalSpaceWidth;

      if (align === "center") {
        startX = MARGIN + indent + (maxWidth - (spaceTotal + naturalSpaceWidth * (line.length - 1))) / 2;
      } else if (align === "right") {
        startX = MARGIN + indent + (maxWidth - (spaceTotal + naturalSpaceWidth * (line.length - 1)));
      } else if (align === "justify" && !isLastLine && line.length > 1) {
        gapWidth = (maxWidth - spaceTotal) / gapCount;
      }

      let x = startX;
      for (const w of line) {
        if (w.run.highlight) {
          this.page.drawRectangle({
            x,
            y: this.y - fontSize * 0.22,
            width: w.width,
            height: fontSize * 1.15,
            color: hexToColor(w.run.highlight),
          });
        }
        const color = w.run.color ? hexToColor(w.run.color) : INK;
        this.page.drawText(w.text, { x, y: this.y, size: w.size, font: w.font, color });
        if (w.run.underline) {
          this.page.drawLine({ start: { x, y: this.y - 1.5 }, end: { x: x + w.width, y: this.y - 1.5 }, thickness: 0.7, color });
        }
        if (w.run.strike) {
          this.page.drawLine({ start: { x, y: this.y + w.size * 0.32 }, end: { x: x + w.width, y: this.y + w.size * 0.32 }, thickness: 0.7, color });
        }
        x += w.width + gapWidth;
      }
      this.y -= lh;
      line = [];
      lineWidth = 0;
    };

    for (const word of words) {
      const font = this.fontFor(Boolean(word.run.bold), Boolean(word.run.italic));
      const width = font.widthOfTextAtSize(word.text, word.size);
      const spaceWidth = this.fonts.regular.widthOfTextAtSize(" ", fontSize);
      const extra = (line.length > 0 ? spaceWidth : 0) + width;
      if (lineWidth + extra > maxWidth && line.length > 0) {
        flushLine(false);
      }
      line.push({ text: word.text, run: word.run, size: word.size, font, width });
      lineWidth += (line.length > 1 ? this.fonts.regular.widthOfTextAtSize(" ", fontSize) : 0) + width;
    }
    flushLine(true);
  }

  addHeading(text: string, level: number, align: Align = "left") {
    const fontSize = Math.max(13, 22 - level * 2);
    this.ensureSpace(fontSize * 2);
    this.y -= fontSize * 0.4;
    this.drawWrapped([{ text, bold: true }], { fontSize, lineHeight: 1.2, align });
    this.y -= fontSize * 0.3;
  }

  addParagraph(runs: Run[], align: Align = "left") {
    if (runs.every((r) => r.text.trim() === "")) return;
    this.drawWrapped(runs, { fontSize: 11, align });
    this.y -= 8;
  }

  addListItem(runs: Run[], ordered: boolean, index: number, indentLevel = 0, align: Align = "left") {
    const marker = ordered ? `${index}.` : "•";
    const indent = 18 + indentLevel * 18;
    this.ensureSpace(11 * 1.35);
    this.page.drawText(marker, { x: MARGIN + indentLevel * 18, y: this.y, size: 11, font: this.fonts.regular, color: INK });
    this.drawWrapped(runs, { fontSize: 11, indent, align });
    this.y -= 4;
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}
