"use client";

import { useState } from "react";
import type { FileScanStatus } from "@/lib/data/browser";
import { isPreviewableServerSide, previewKind } from "@/lib/mime-preview";
import { supportedConversions } from "@/lib/convert/supported";
import { stripImageMetadata } from "@/lib/strip-metadata";
import { optimizeSvg } from "@/lib/optimize-svg";
import { uploadFile } from "@/lib/client-upload";
import { renameFile } from "@/lib/actions/file-actions";
import { convertFile } from "@/lib/actions/convert-actions";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export function triggerDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export type FileItemInput = {
  id: string;
  name: string;
  size: bigint;
  mimeType: string;
  folderId?: string | null;
  scanStatus?: FileScanStatus;
};

export function useFileItemActions({
  id,
  name,
  mimeType,
  folderId = null,
  scanStatus = "SKIPPED",
}: FileItemInput) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pdfToolMode, setPdfToolMode] = useState<"rotate" | "extract" | "watermark" | "compress" | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [strippingMeta, setStrippingMeta] = useState(false);
  const [optimizingSvg, setOptimizingSvg] = useState(false);
  const [audioTrimOpen, setAudioTrimOpen] = useState(false);
  const [publishReelOpen, setPublishReelOpen] = useState(false);
  const [videoTrimOpen, setVideoTrimOpen] = useState(false);
  const [docxEditOpen, setDocxEditOpen] = useState(false);
  const [xlsxEditOpen, setXlsxEditOpen] = useState(false);
  const [pdfEditOpen, setPdfEditOpen] = useState(false);

  const renameAction = renameFile.bind(null, id);
  const previewable = isPreviewableServerSide(mimeType);
  const isImage = previewKind(mimeType) === "image";
  const isPdf = mimeType === "application/pdf";
  const isSvg = mimeType === "image/svg+xml";
  const isAudio = previewKind(mimeType) === "audio";
  const isVideo = previewKind(mimeType) === "video";
  const isDocx = mimeType === DOCX_MIME;
  const isXlsx = XLSX_MIMES.has(mimeType);
  const conversions = supportedConversions(name, mimeType);
  const isInfected = scanStatus === "INFECTED";
  const isScanning = scanStatus === "PENDING";

  async function handleConvert(toExt: string) {
    setConverting(true);
    setConvertError(null);
    try {
      await convertFile(id, toExt);
    } catch {
      setConvertError(`Couldn't convert ${name}.`);
    } finally {
      setConverting(false);
    }
  }

  async function handleStripMetadata() {
    setStrippingMeta(true);
    setConvertError(null);
    try {
      const blob = await stripImageMetadata(`/api/files/${id}/download?inline=1`, mimeType);
      const cleanedName = `${name.replace(/\.[^.]+$/, "")} (no metadata)${name.match(/\.[^.]+$/)?.[0] ?? ""}`;
      await uploadFile(new File([blob], cleanedName, { type: blob.type }), folderId, () => {});
    } catch {
      setConvertError(`Couldn't remove metadata from ${name}.`);
    } finally {
      setStrippingMeta(false);
    }
  }

  async function handleOptimizeSvg() {
    setOptimizingSvg(true);
    setConvertError(null);
    try {
      const blob = await optimizeSvg(`/api/files/${id}/download`);
      const optimizedName = `${name.replace(/\.svg$/i, "")} (optimized).svg`;
      await uploadFile(new File([blob], optimizedName, { type: "image/svg+xml" }), folderId, () => {});
    } catch {
      setConvertError(`Couldn't optimize ${name}.`);
    } finally {
      setOptimizingSvg(false);
    }
  }

  return {
    renameOpen,
    setRenameOpen,
    deleteOpen,
    setDeleteOpen,
    shareOpen,
    setShareOpen,
    moveOpen,
    setMoveOpen,
    previewOpen,
    setPreviewOpen,
    editorOpen,
    setEditorOpen,
    pdfToolMode,
    setPdfToolMode,
    converting,
    convertError,
    setConvertError,
    strippingMeta,
    optimizingSvg,
    audioTrimOpen,
    setAudioTrimOpen,
    publishReelOpen,
    setPublishReelOpen,
    videoTrimOpen,
    setVideoTrimOpen,
    docxEditOpen,
    setDocxEditOpen,
    xlsxEditOpen,
    setXlsxEditOpen,
    pdfEditOpen,
    setPdfEditOpen,
    renameAction,
    previewable,
    isImage,
    isPdf,
    isSvg,
    isAudio,
    isVideo,
    isDocx,
    isXlsx,
    conversions,
    isInfected,
    isScanning,
    handleConvert,
    handleStripMetadata,
    handleOptimizeSvg,
    triggerDownload,
  };
}
