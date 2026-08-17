"use client";

// No official TipTap font-size extension matches this project's installed
// v3.30.1 core (the published @tiptap/extension-font-size package is stuck
// on a mismatched 3.0.0-next prerelease) — this is the standard, documented
// recipe for adding one: extend TextStyle with a fontSize attribute that
// renders as an inline style, matching how Color/Highlight already work.
import { TextStyle } from "@tiptap/extension-text-style";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/['"]+/g, "") || null,
        renderHTML: (attributes: { fontSize?: string | null }) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark(this.name, { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});
