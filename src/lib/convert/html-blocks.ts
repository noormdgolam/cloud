import type { Align, Run } from "./pdf-text-writer";

export type Block =
  | { kind: "heading"; level: number; runs: Run[]; align?: Align }
  | { kind: "paragraph"; runs: Run[]; align?: Align }
  | { kind: "listitem"; ordered: boolean; index: number; runs: Run[]; indentLevel?: number; align?: Align };

type Token =
  | { type: "open"; tag: string; attrs: Record<string, string> }
  | { type: "close"; tag: string }
  | { type: "text"; text: string };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#?\w+);/g, (match, name) => ENTITIES[name] ?? match);
}

// Minimal attribute parser for the handful of attrs this converter cares
// about (style, href) — not a general HTML attribute grammar, just enough
// to read what TipTap/mammoth actually emit (double- or single-quoted
// values; unquoted values are rare enough in generated HTML to skip).
function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const name = (match[1] ?? match[3]).toLowerCase();
    const value = match[2] ?? match[4] ?? "";
    attrs[name] = value;
  }
  return attrs;
}

function parseStyle(style: string | undefined): Record<string, string> {
  if (!style) return {};
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (prop) out[prop] = value;
  }
  return out;
}

// "rgb(255, 0, 0)" / "#ff0000" / "red" (a small named-color subset covering
// what TipTap's default color picker and mammoth's docx-color output
// actually produce) -> "#rrggbb". Anything unrecognized is dropped rather
// than guessed at.
const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
};

function normalizeColor(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (v.startsWith("#")) return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v.slice(0, 7);
  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  }
  return NAMED_COLORS[v];
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const end = html.indexOf(">", i);
      if (end === -1) break;
      const raw = html.slice(i + 1, end);
      if (raw.startsWith("!")) {
        // comment / doctype — skip
      } else if (raw.startsWith("/")) {
        tokens.push({ type: "close", tag: raw.slice(1).trim().toLowerCase() });
      } else {
        const tag = raw.split(/\s/)[0].replace(/\/$/, "").toLowerCase();
        const attrs = parseAttrs(raw.slice(tag.length));
        tokens.push({ type: "open", tag, attrs });
        // self-closing void elements never get a matching close token
        if (["br", "img", "hr"].includes(tag)) tokens.push({ type: "close", tag });
      }
      i = end + 1;
    } else {
      const nextLt = html.indexOf("<", i);
      const textEnd = nextLt === -1 ? html.length : nextLt;
      const text = decodeEntities(html.slice(i, textEnd));
      if (text.trim()) tokens.push({ type: "text", text });
      i = textEnd;
    }
  }
  return tokens;
}

const BOLD_TAGS = new Set(["strong", "b"]);
const ITALIC_TAGS = new Set(["em", "i"]);
const UNDERLINE_TAGS = new Set(["u"]);
const STRIKE_TAGS = new Set(["s", "strike", "del"]);

// Mutable per-run formatting state threaded through collectRunsUntil —
// pushed/popped as a stack per tag so nesting (e.g. bold inside a colored
// span) resolves correctly on close.
type RunState = { bold: boolean; italic: boolean; underline: boolean; strike: boolean; color?: string; highlight?: string; fontSize?: number; href?: string };

function applyOpenTag(state: RunState, tag: string, attrs: Record<string, string>): Partial<RunState> {
  const prev: Partial<RunState> = {};
  if (BOLD_TAGS.has(tag)) {
    prev.bold = state.bold;
    state.bold = true;
  } else if (ITALIC_TAGS.has(tag)) {
    prev.italic = state.italic;
    state.italic = true;
  } else if (UNDERLINE_TAGS.has(tag)) {
    prev.underline = state.underline;
    state.underline = true;
  } else if (STRIKE_TAGS.has(tag)) {
    prev.strike = state.strike;
    state.strike = true;
  } else if (tag === "a") {
    prev.href = state.href;
    state.href = attrs.href;
  }

  const style = parseStyle(attrs.style);
  if (style["text-decoration"]?.includes("underline")) {
    prev.underline = prev.underline ?? state.underline;
    state.underline = true;
  }
  if (style["text-decoration"]?.includes("line-through")) {
    prev.strike = prev.strike ?? state.strike;
    state.strike = true;
  }
  if (style.color) {
    const c = normalizeColor(style.color);
    if (c) {
      prev.color = prev.color === undefined ? state.color : prev.color;
      state.color = c;
    }
  }
  if (style["background-color"]) {
    const c = normalizeColor(style["background-color"]);
    if (c) {
      prev.highlight = prev.highlight === undefined ? state.highlight : prev.highlight;
      state.highlight = c;
    }
  }
  if (tag === "mark" && !style["background-color"]) {
    // <mark> with no explicit color (TipTap's default Highlight extension
    // output) — a conventional yellow highlight, matching every mainstream
    // editor's default mark color.
    prev.highlight = prev.highlight === undefined ? state.highlight : prev.highlight;
    state.highlight = "#ffff00";
  }
  if (style["font-size"]) {
    const match = /([\d.]+)pt/.exec(style["font-size"]);
    if (match) {
      prev.fontSize = prev.fontSize === undefined ? state.fontSize : prev.fontSize;
      state.fontSize = Number(match[1]);
    }
  }
  return prev;
}

// The stack is keyed by open-tag position (LIFO), not by tag name, so a
// close just restores whatever fields that specific open tag touched —
// correctly unwinds arbitrary nesting like <span style="color:red"><b>.
function undoTag(state: RunState, saved: Partial<RunState>) {
  if ("bold" in saved) state.bold = saved.bold!;
  if ("italic" in saved) state.italic = saved.italic!;
  if ("underline" in saved) state.underline = saved.underline!;
  if ("strike" in saved) state.strike = saved.strike!;
  if ("href" in saved) state.href = saved.href;
  if ("color" in saved) state.color = saved.color;
  if ("highlight" in saved) state.highlight = saved.highlight;
  if ("fontSize" in saved) state.fontSize = saved.fontSize;
}

function toRun(text: string, state: RunState): Run {
  return {
    text,
    bold: state.bold || undefined,
    italic: state.italic || undefined,
    underline: state.underline || undefined,
    strike: state.strike || undefined,
    color: state.color,
    highlight: state.highlight,
    fontSize: state.fontSize,
    href: state.href,
  };
}

function parseAlign(attrs: Record<string, string>): Align | undefined {
  const style = parseStyle(attrs.style);
  const value = style["text-align"];
  if (value === "center" || value === "right" || value === "justify" || value === "left") return value;
  return undefined;
}

/**
 * Turns HTML (mammoth's docx->HTML output, or a TipTap editor's getHTML())
 * into a flat block list (headings, paragraphs, list items) with per-run
 * formatting — everything this codebase's local docx-to-PDF renderer and
 * docx-writer.ts need, without pulling in a real HTML/DOM parser dependency.
 * Tables and anything else unrecognized still contribute their text (as a
 * plain paragraph) rather than being silently dropped — this is a "readable
 * document" converter, not a layout-perfect one.
 */
export function parseBlocks(html: string): Block[] {
  const tokens = tokenize(html);
  const blocks: Block[] = [];
  let i = 0;

  function collectRunsUntil(endTag: string): Run[] {
    const runs: Run[] = [];
    const state: RunState = { bold: false, italic: false, underline: false, strike: false };
    const stack: Partial<RunState>[] = [];
    let depth = 1;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === "open" && t.tag === endTag) depth++;
      if (t.type === "close" && t.tag === endTag) {
        depth--;
        i++;
        if (depth === 0) break;
        continue;
      }
      if (t.type === "open") {
        stack.push(applyOpenTag(state, t.tag, t.attrs));
      } else if (t.type === "close") {
        const saved = stack.pop();
        if (saved) undoTag(state, saved);
      } else {
        runs.push(toRun(t.text, state));
      }
      i++;
    }
    return runs;
  }

  function skipAndExtractText(tag: string): Run[] {
    const runs: Run[] = [];
    let depth = 1;
    i++; // past the opening tag already consumed by caller
    while (i < tokens.length && depth > 0) {
      const t = tokens[i];
      if (t.type === "open" && t.tag === tag) depth++;
      else if (t.type === "close" && t.tag === tag) depth--;
      else if (t.type === "text") runs.push({ text: t.text });
      // Table cells, rows, and paragraphs each wrap their own text in this
      // fallback path — without a separator here, adjacent cells' text runs
      // together unreadably ("Top leftTop right...").
      else if (t.type === "close") runs.push({ text: " " });
      i++;
    }
    return runs;
  }

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type !== "open") {
      i++;
      continue;
    }

    if (/^h[1-6]$/.test(t.tag)) {
      const level = Number(t.tag[1]);
      const align = parseAlign(t.attrs);
      i++;
      blocks.push({ kind: "heading", level, runs: collectRunsUntil(t.tag), align });
    } else if (t.tag === "p" || t.tag === "blockquote") {
      const align = parseAlign(t.attrs);
      i++;
      const runs = collectRunsUntil(t.tag);
      if (runs.some((r) => r.text.trim())) blocks.push({ kind: "paragraph", runs, align });
    } else if (t.tag === "ul" || t.tag === "ol") {
      const ordered = t.tag === "ol";
      const closingTag = t.tag;
      i++;
      let index = 1;
      while (i < tokens.length) {
        const cur = tokens[i];
        if (cur.type === "close" && cur.tag === closingTag) break;
        if (cur.type === "open" && cur.tag === "li") {
          const align = parseAlign(cur.attrs);
          i++;
          const runs = collectRunsUntil("li");
          blocks.push({ kind: "listitem", ordered, index: index++, runs, align });
        } else {
          i++;
        }
      }
      i++; // consume closing ul/ol
    } else if (t.tag === "img" || t.tag === "br" || t.tag === "hr") {
      i += 2; // open + its synthetic close
    } else {
      // Unknown block (table, div, span-at-top-level, etc.) — never silently
      // drop the content, just fall back to plain-paragraph text.
      const runs = skipAndExtractText(t.tag);
      if (runs.some((r) => r.text.trim())) blocks.push({ kind: "paragraph", runs });
    }
  }

  return blocks;
}
