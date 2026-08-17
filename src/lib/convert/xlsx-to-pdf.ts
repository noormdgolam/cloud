import "server-only";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_WIDTH = 792; // US Letter landscape, points
const PAGE_HEIGHT = 612;
const MARGIN = 36;
const ROW_HEIGHT = 18;
const FONT_SIZE = 8;
const MAX_COLS = 14; // beyond this, columns would be too narrow to read at all

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(result + "…", size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + "…";
}

/**
 * Renders an .xlsx to PDF entirely locally — SheetJS parses the workbook
 * (same library OfficePreview.tsx already uses for in-app preview), then
 * this draws each sheet as a bordered grid with pdf-lib. Equal-width
 * columns and a fixed row height rather than reproducing Excel's exact
 * column widths/merged cells — a readable data table, not a pixel-perfect
 * clone. No external API, no system binary.
 */
export async function xlsxToPdf(buffer: Buffer): Promise<Buffer> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage | null = null;
  let y = 0;

  function newPage(title: string) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText(title, { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.12) });
    y -= 20;
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    if (rows.length === 0) continue;

    const numCols = Math.min(MAX_COLS, Math.max(...rows.map((r) => r.length)));
    const usableWidth = PAGE_WIDTH - MARGIN * 2;
    const colWidth = usableWidth / numCols;

    newPage(`Sheet: ${sheetName}`);
    const headerRow = rows[0];

    const drawRow = (row: unknown[], isHeader: boolean) => {
      if (y - ROW_HEIGHT < MARGIN) {
        newPage(`Sheet: ${sheetName} (cont.)`);
        if (!isHeader) drawRow(headerRow, true);
      }
      const font = isHeader ? bold : regular;
      let x = MARGIN;
      for (let c = 0; c < numCols; c++) {
        const raw = row[c];
        const text = raw === undefined || raw === null ? "" : String(raw);
        page!.drawRectangle({ x, y: y - ROW_HEIGHT, width: colWidth, height: ROW_HEIGHT, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
        if (text) {
          page!.drawText(truncateToWidth(text, font, FONT_SIZE, colWidth - 6), {
            x: x + 3,
            y: y - ROW_HEIGHT + 5,
            size: FONT_SIZE,
            font,
            color: rgb(0.1, 0.1, 0.12),
          });
        }
        x += colWidth;
      }
      y -= ROW_HEIGHT;
    };

    drawRow(headerRow, true);
    for (let r = 1; r < rows.length; r++) drawRow(rows[r], false);
  }

  return Buffer.from(await doc.save());
}
