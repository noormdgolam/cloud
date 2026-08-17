// VirusTotal integration for scanning uploaded files. No "server-only" here
// — unlike src/lib/ai-assistant/groq.ts, this is imported by quota.ts (a
// normal request-path module) and could plausibly be exercised by a
// standalone script too, so it needs to stay importable outside Next's own
// bundler.
import { prisma } from "@/lib/prisma";
import { createFileReadStream } from "@/lib/storage";

const VT_BASE = "https://www.virustotal.com/api/v3";
// VT's direct /files upload caps at 32MB; above that, a file needs a
// short-lived special upload URL (still free, still the public API) that
// supports up to 650MB. This app caps well below VT's own ceiling — see
// SUBMIT_MAX_BYTES below — purely to keep memory use sane on a shared host
// (the whole file gets buffered into memory to build the multipart body).
const DIRECT_UPLOAD_MAX_BYTES = 32 * 1024 * 1024;
const SUBMIT_MAX_BYTES = 200 * 1024 * 1024;

function apiKey(): string | null {
  return process.env.VIRUSTOTAL_API_KEY || null;
}

type AnalysisStats = {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  timeout: number;
};

// Requiring 2+ engines to agree (rather than 1) trades a little detection
// sensitivity for fewer false positives on legitimate user files — a single
// AV engine flagging a file is common noise, especially for less-common
// file types; VirusTotal's own community guidance treats low-count
// detections with skepticism for exactly this reason.
function verdictFromStats(stats: AnalysisStats): "CLEAN" | "INFECTED" {
  return stats.malicious >= 2 ? "INFECTED" : "CLEAN";
}

async function vtFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = apiKey();
  if (!key) throw new Error("VIRUSTOTAL_API_KEY not configured.");
  return fetch(`${VT_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-apikey": key },
  });
}

// Instant, free, zero-file-bytes-sent lookup against VT's cache of
// previously-scanned files. Almost every common file (any image, any
// well-known document/app installer, etc) resolves here.
async function lookupHash(
  hash: string
): Promise<{ known: true; stats: AnalysisStats } | { known: false }> {
  const res = await vtFetch(`/files/${hash}`);
  if (res.status === 404) return { known: false };
  if (!res.ok) throw new Error(`VirusTotal hash lookup failed: ${res.status}`);
  const body = (await res.json()) as {
    data: { attributes: { last_analysis_stats: AnalysisStats } };
  };
  return { known: true, stats: body.data.attributes.last_analysis_stats };
}

async function submitForAnalysis(
  storageKey: string,
  filename: string,
  sizeBytes: number
): Promise<string> {
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createFileReadStream(storageKey);
    stream.on("data", (chunk: string | Buffer) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

  let uploadUrl = `${VT_BASE}/files`;
  if (sizeBytes > DIRECT_UPLOAD_MAX_BYTES) {
    const urlRes = await vtFetch("/files/upload_url");
    if (!urlRes.ok) throw new Error(`VirusTotal upload_url failed: ${urlRes.status}`);
    const urlBody = (await urlRes.json()) as { data: string };
    uploadUrl = urlBody.data;
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)]), filename);

  const key = apiKey();
  if (!key) throw new Error("VIRUSTOTAL_API_KEY not configured.");
  const res = await fetch(uploadUrl, { method: "POST", headers: { "x-apikey": key }, body: form });
  if (!res.ok) throw new Error(`VirusTotal submit failed: ${res.status}`);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

/** Called right after a file transitions to COMMITTED. Never throws — a scan
 * failure must never fail (or even delay) the upload response, since this
 * always runs after commitQuota has already resolved. */
export async function kickoffScanForFile(file: {
  id: string;
  storageKey: string;
  originalName: string;
  size: bigint;
  checksumSha256: string | null;
}): Promise<void> {
  if (!apiKey()) {
    await prisma.file.update({ where: { id: file.id }, data: { scanStatus: "SKIPPED" } });
    return;
  }

  const sizeBytes = Number(file.size);
  try {
    if (file.checksumSha256) {
      const known = await lookupHash(file.checksumSha256);
      if (known.known) {
        await prisma.file.update({
          where: { id: file.id },
          data: { scanStatus: verdictFromStats(known.stats), scanCheckedAt: new Date() },
        });
        return;
      }
    }

    if (sizeBytes > SUBMIT_MAX_BYTES) {
      // Too large to submit for a fresh scan — not flagged either way.
      await prisma.file.update({ where: { id: file.id }, data: { scanStatus: "SKIPPED" } });
      return;
    }

    const analysisId = await submitForAnalysis(file.storageKey, file.originalName, sizeBytes);
    await prisma.file.update({
      where: { id: file.id },
      data: { scanStatus: "PENDING", scanAnalysisId: analysisId },
    });
  } catch (error) {
    console.error(`Virus scan kickoff failed for file ${file.id}:`, error);
    await prisma.file
      .update({ where: { id: file.id }, data: { scanStatus: "ERROR", scanCheckedAt: new Date() } })
      .catch(() => {});
  }
}

/** Polls every file still awaiting a VirusTotal verdict — either a
 * submitted analysis, or one whose initial hash-lookup/submit never got a
 * chance to run (kickoff failed before writing an analysis id). Processes a
 * bounded batch per call to stay well under VT's free-tier rate limit
 * (4 req/min, ~500/day) — this is meant to be called every ~10 minutes. */
export async function pollPendingScans(batchSize = 15): Promise<{ resolved: number; stillPending: number }> {
  if (!apiKey()) return { resolved: 0, stillPending: 0 };

  const pending = await prisma.file.findMany({
    where: { scanStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true, storageKey: true, originalName: true, size: true, checksumSha256: true, scanAnalysisId: true },
  });

  let resolved = 0;
  let stillPending = 0;

  for (const file of pending) {
    try {
      if (!file.scanAnalysisId) {
        // Kickoff never got as far as submitting — retry it wholesale.
        await kickoffScanForFile(file);
        const updated = await prisma.file.findUnique({ where: { id: file.id }, select: { scanStatus: true } });
        if (updated?.scanStatus === "PENDING") stillPending++;
        else resolved++;
        continue;
      }

      const res = await vtFetch(`/analyses/${file.scanAnalysisId}`);
      if (!res.ok) throw new Error(`VirusTotal analysis poll failed: ${res.status}`);
      const body = (await res.json()) as {
        data: { attributes: { status: "queued" | "completed"; stats?: AnalysisStats } };
      };

      if (body.data.attributes.status !== "completed" || !body.data.attributes.stats) {
        stillPending++;
        continue;
      }

      await prisma.file.update({
        where: { id: file.id },
        data: { scanStatus: verdictFromStats(body.data.attributes.stats), scanCheckedAt: new Date() },
      });
      resolved++;
    } catch (error) {
      console.error(`Virus scan poll failed for file ${file.id}:`, error);
      stillPending++;
    }
  }

  return { resolved, stillPending };
}
