import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  File as FileIcon,
} from "lucide-react";

/**
 * Returns a fixed JSX element rather than a component reference — assigning
 * one of these to a capitalized variable and rendering it as `<Icon />`
 * trips the "components created during render" lint rule, since the linter
 * can't statically prove the reference is stable across renders.
 */
export function mimeIcon(mimeType: string, className: string) {
  const props = { className, strokeWidth: 1.75, "aria-hidden": true as const };

  if (mimeType.startsWith("image/")) return <ImageIcon {...props} />;
  if (mimeType.startsWith("video/")) return <Video {...props} />;
  if (mimeType.startsWith("audio/")) return <Music {...props} />;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return <FileText {...props} />;
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return <Archive {...props} />;
  return <FileIcon {...props} />;
}
