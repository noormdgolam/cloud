import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { resolveStoragePath } from "@/lib/storage";

export type ModerationResult = {
  isAdult: boolean;
  category: "SAFE" | "EXPLICIT_NUDITY" | "SUGGESTIVE" | "VIOLENCE" | "OTHER";
  confidence: number;
  reason: string;
};

const SYSTEM_PROMPT = `You are an automated content moderation safety system. Analyze the uploaded image and detect if it contains adult content, pornography, sexually explicit nudity, suggestive sexual poses, violence, or NSFW material.

Return ONLY a raw JSON object (no markdown, no code fence) matching this exact schema:
{
  "isAdult": boolean,
  "category": "SAFE" | "EXPLICIT_NUDITY" | "SUGGESTIVE" | "VIOLENCE" | "OTHER",
  "confidence": number,
  "reason": "short explanation under 30 words"
}
Note: "confidence" must be a float between 0.0 and 1.0.`;

async function callVisionApi(mimeType: string, base64Data: string): Promise<ModerationResult> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (groqKey) {
    const model = process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this image for content moderation." },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Data}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      throw new Error(`Groq Vision API failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty response from Groq Vision");
    return JSON.parse(rawContent) as ModerationResult;
  }

  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this image for content moderation." },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Data}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI Vision API failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty response from OpenAI Vision");
    return JSON.parse(rawContent) as ModerationResult;
  }

  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                { text: "Classify this image for content moderation. Return valid JSON only." },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini Vision");
    return JSON.parse(rawText) as ModerationResult;
  }

  throw new Error("No Vision AI key configured (set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in .env).");
}

export async function scanImageForAdultContent(fileId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { id: true, storageKey: true, mimeType: true, originalName: true, status: true },
  });

  if (!file || file.status !== "COMMITTED") {
    throw new Error("File not found or not yet committed.");
  }

  if (!file.mimeType.startsWith("image/")) {
    throw new Error(`File is not an image (mimeType: ${file.mimeType}).`);
  }

  const filePath = resolveStoragePath(file.storageKey);
  const buffer = await readFile(filePath);
  const base64Data = buffer.toString("base64");

  try {
    const result = await callVisionApi(file.mimeType, base64Data);

    const isAdult = Boolean(result.isAdult);
    const confidence = typeof result.confidence === "number" ? Math.min(1, Math.max(0, result.confidence)) : 0.8;
    const category = result.category || (isAdult ? "EXPLICIT_NUDITY" : "SAFE");
    const reason = result.reason || (isAdult ? "Adult / NSFW content detected" : "Safe content");

    let status: "SAFE" | "FLAGGED_ADULT" | "FLAGGED_SUGGESTIVE" = "SAFE";
    if (category === "EXPLICIT_NUDITY" || (isAdult && confidence >= 0.5)) {
      status = "FLAGGED_ADULT";
    } else if (category === "SUGGESTIVE") {
      status = "FLAGGED_SUGGESTIVE";
    }

    const moderation = await prisma.fileModeration.upsert({
      where: { fileId: file.id },
      create: {
        fileId: file.id,
        status,
        confidence,
        category,
        reason,
        flaggedAt: status !== "SAFE" ? new Date() : null,
        scannedAt: new Date(),
      },
      update: {
        status,
        confidence,
        category,
        reason,
        flaggedAt: status !== "SAFE" ? new Date() : null,
        scannedAt: new Date(),
      },
    });

    return { success: true, moderation, result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await prisma.fileModeration.upsert({
      where: { fileId: file.id },
      create: {
        fileId: file.id,
        status: "ERROR",
        reason: `Scan error: ${errorMsg.slice(0, 400)}`,
        scannedAt: new Date(),
      },
      update: {
        status: "ERROR",
        reason: `Scan error: ${errorMsg.slice(0, 400)}`,
        scannedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function scanBatchModeration(limit = 10) {
  // Find committed images that have either no FileModeration record or are marked UNSCANNED / ERROR
  const unscannedFiles = await prisma.file.findMany({
    where: {
      status: "COMMITTED",
      mimeType: { startsWith: "image/" },
      OR: [
        { moderation: null },
        { moderation: { status: "UNSCANNED" } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { id: true, originalName: true },
  });

  const results: { fileId: string; name: string; success: boolean; status?: string; error?: string }[] = [];

  for (const file of unscannedFiles) {
    try {
      const res = await scanImageForAdultContent(file.id);
      results.push({ fileId: file.id, name: file.originalName, success: true, status: res.moderation.status });
    } catch (err) {
      results.push({
        fileId: file.id,
        name: file.originalName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const flagged = results.filter((r) => r.status === "FLAGGED_ADULT" || r.status === "FLAGGED_SUGGESTIVE").length;
  const safe = results.filter((r) => r.status === "SAFE").length;
  const errors = results.filter((r) => !r.success).length;

  return {
    scannedCount: results.length,
    flagged,
    safe,
    errors,
    results,
  };
}

export async function getModerationStats() {
  const [totalImages, scannedCount, flaggedAdult, flaggedSuggestive] = await Promise.all([
    prisma.file.count({ where: { status: "COMMITTED", mimeType: { startsWith: "image/" } } }),
    prisma.fileModeration.count({ where: { status: { in: ["SAFE", "FLAGGED_ADULT", "FLAGGED_SUGGESTIVE"] } } }),
    prisma.fileModeration.count({ where: { status: "FLAGGED_ADULT" } }),
    prisma.fileModeration.count({ where: { status: "FLAGGED_SUGGESTIVE" } }),
  ]);

  const pendingCount = Math.max(0, totalImages - scannedCount);

  return {
    totalImages,
    scannedCount,
    flaggedAdult,
    flaggedSuggestive,
    totalFlagged: flaggedAdult + flaggedSuggestive,
    pendingCount,
  };
}
