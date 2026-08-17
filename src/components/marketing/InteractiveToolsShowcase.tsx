"use client";

import { useState } from "react";
import {
  AudioLines,
  Clapperboard,
  Combine,
  FileCode,
  FileSpreadsheet,
  FileText,
  Minimize2,
  RotateCw,
  ScanLine,
  Scissors,
  ShieldOff,
  Sparkles,
  Stamp,
  Wand2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";

type CategoryKey = "pdf" | "office" | "media" | "collaboration";

type ToolItem = {
  icon: typeof Wand2;
  title: string;
  badge: string;
  description: string;
  highlight: string;
};

const CATEGORIES: {
  id: CategoryKey;
  label: string;
  icon: typeof FileText;
  headline: string;
  summary: string;
  tools: ToolItem[];
}[] = [
  {
    id: "pdf",
    label: "PDF Suite",
    icon: FileText,
    headline: "All-in-One Professional PDF Toolkit",
    summary:
      "Perform high-speed manipulations directly on your documents without sending unencrypted files to third-party ad converters.",
    tools: [
      {
        icon: Combine,
        title: "Merge PDFs",
        badge: "Zero Loss",
        description: "Combine multiple PDF reports, receipts, or contracts into a single organized document.",
        highlight: "Instant re-ordering",
      },
      {
        icon: Minimize2,
        title: "Compress PDF",
        badge: "Lossless",
        description: "Deduplicate PDF objects and shrink document file size for faster email and chat sharing.",
        highlight: "Up to 70% smaller",
      },
      {
        icon: RotateCw,
        title: "Rotate & Straighten",
        badge: "Page Control",
        description: "Rotate inverted pages 90°, 180°, or 270° in real-time.",
        highlight: "Batch page rotate",
      },
      {
        icon: Scissors,
        title: "Extract Pages",
        badge: "Selective",
        description: "Select and pull individual pages or ranges into clean new PDF files.",
        highlight: "Custom page ranges",
      },
      {
        icon: Stamp,
        title: "Watermark PDF",
        badge: "Security",
        description: "Apply customized confidentiality stamps or company watermarks across all pages.",
        highlight: "Custom angle & opacity",
      },
      {
        icon: ScanLine,
        title: "Document OCR Scanner",
        badge: "AI Powered",
        description: "Extract readable text from phone pictures and document scans using integrated Tesseract OCR.",
        highlight: "Searchable output",
      },
    ],
  },
  {
    id: "office",
    label: "Office Suite",
    icon: FileSpreadsheet,
    headline: "Edit Word & Excel Directly in the Browser",
    summary:
      "No desktop Microsoft Office or license required. View, edit, and format documents right inside your Bongshai Cloud drive.",
    tools: [
      {
        icon: FileText,
        title: "Word (.docx) Editor",
        badge: "Rich Text",
        description: "Full Tiptap-powered editor for Microsoft Word documents with typography, colors, headings, and lists.",
        highlight: "Real-time preview & save",
      },
      {
        icon: FileSpreadsheet,
        title: "Excel (.xlsx) Editor",
        badge: "Full Grid",
        description: "Inspect spreadsheets, edit formula cells, format tables, and export updated workbooks via ExcelJS.",
        highlight: "Multi-sheet support",
      },
      {
        icon: FileCode,
        title: "Format Converter",
        badge: "Bidirectional",
        description: "Convert Word and Excel files into PDFs or transform image batches into print-ready PDF files.",
        highlight: "DOCX / XLSX ⇄ PDF",
      },
    ],
  },
  {
    id: "media",
    label: "Media Studio",
    icon: Clapperboard,
    headline: "Audio Waveform, Video Reels & Privacy Tools",
    summary:
      "Clean metadata, optimize vector graphics, cut sound clips, and compose short videos directly from your storage dashboard.",
    tools: [
      {
        icon: AudioLines,
        title: "Waveform Audio Cutter",
        badge: "Visual Waveform",
        description: "Trim voice notes, podcasts, or music tracks with precision visual start/end waveform markers.",
        highlight: "Lossless audio slicing",
      },
      {
        icon: ShieldOff,
        title: "EXIF & GPS Stripper",
        badge: "Privacy First",
        description: "Erase camera metadata, phone model, and embedded GPS location coordinates from photos before sharing.",
        highlight: "100% Client-side scrub",
      },
      {
        icon: Sparkles,
        title: "SVGO Vector Optimizer",
        badge: "Web Ready",
        description: "Minify SVG markup and strip developer comments to maximize frontend loading performance.",
        highlight: "Reduced bundle size",
      },
      {
        icon: Clapperboard,
        title: "Reels Video Generator",
        badge: "Creator Tool",
        description: "Turn photo carousels, text captions, and background audio into vertical video reels for the public feed.",
        highlight: "Direct /reels export",
      },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration & Sharing",
    icon: Wand2,
    headline: "Frictionless Sharing & Client File Dropboxes",
    summary:
      "Share large assets with clients, collect files without giving account access, and enforce military-grade malware checks.",
    tools: [
      {
        icon: Wand2,
        title: "File Request Dropboxes",
        badge: "Zero Signup for Clients",
        description: "Send a dedicated upload link so clients or teammates can drop large files directly into your folder.",
        highlight: "Direct folder routing",
      },
      {
        icon: Sparkles,
        title: "Cryptographic Share Links",
        badge: "Expiring Links",
        description: "Generate tokenized download links with custom expiration timestamps (e.g. 1 hour, 1 day, 7 days).",
        highlight: "Revoke anytime",
      },
      {
        icon: ShieldOff,
        title: "VirusTotal Security",
        badge: "Malware Clean",
        description: "Every incoming file is screened against global malware definitions before download links activate.",
        highlight: "Real-time threat check",
      },
    ],
  },
];

export function InteractiveToolsShowcase() {
  const [activeTab, setActiveTab] = useState<CategoryKey>("pdf");
  const currentCategory = CATEGORIES.find((c) => c.id === activeTab) ?? CATEGORIES[0];

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20" id="tools-showcase">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge>Integrated Power Tools</Badge>
          <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            What built-in tools does Bongshai Cloud include for documents and media?
          </h2>
          <p className="mt-3 text-sm text-ink-muted sm:text-base">
            No need to install separate software or upload sensitive files to random conversion websites. Edit, convert, and secure files right in your drive.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 pb-8">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isActive = activeTab === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveTab(category.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-accent text-white shadow-[0_4px_16px_rgba(106,75,255,0.35)]"
                    : "glass text-ink-muted hover:bg-[var(--glass-surface-hover)] hover:text-ink"
                }`}
                data-mcp-action="switch_tool_category"
                data-mcp-param-category={category.id}
              >
                <Icon className="size-4" />
                {category.label}
              </button>
            );
          })}
        </div>

        {/* Active Tab Header Card */}
        <GlassCard className="mb-8 p-6 sm:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-accent-2">
                {currentCategory.label}
              </span>
              <h3 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
                {currentCategory.headline}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
                {currentCategory.summary}
              </p>
            </div>
            <LinkButton href="/register" variant="accent" className="shrink-0 self-start text-sm md:self-auto">
              Use tools in dashboard
            </LinkButton>
          </div>
        </GlassCard>

        {/* Tools Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentCategory.tools.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <GlassCard key={tool.title} className="glow-card flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-bg-2">
                      <ToolIcon className="size-5 text-accent" strokeWidth={1.75} />
                    </span>
                    <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[0.7rem] font-medium text-accent">
                      {tool.badge}
                    </span>
                  </div>

                  <h4 className="mt-4 text-base font-semibold text-ink">{tool.title}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">{tool.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-3 text-[0.75rem] text-ink-faint">
                  <span>Feature highlight:</span>
                  <span className="font-mono font-medium text-ink-muted">{tool.highlight}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
