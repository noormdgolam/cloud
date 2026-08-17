import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAnonId } from "@/lib/anon-session";
import { checkRateLimit, getClientIp, RateLimitExceededError } from "@/lib/rate-limit";
import { groqChat, GroqError, type ChatMessage } from "@/lib/ai-assistant/groq";
import { buildSiteSystemPrompt } from "@/lib/ai-assistant/site-context";
import { loadFileContext } from "@/lib/ai-assistant/file-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HISTORY = 12; // messages, not tokens — a cheap cap so no one can balloon a single request's cost

export async function POST(request: NextRequest) {
  let body: { messages?: unknown; fileId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const history: ChatMessage[] = rawMessages
    .filter(
      (m): m is ChatMessage =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0 &&
        m.content.length < 4000
    )
    .slice(-MAX_HISTORY);

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "No user message to respond to." }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  const anonId = userId ? null : await getAnonId();

  try {
    const ip = getClientIp(request);
    await checkRateLimit(`${ip}:assistant:${userId ? "auth" : "anon"}`, {
      limit: userId ? 40 : 15,
      windowMs: 10 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many messages. Try again in a bit." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  const systemPrompt = await buildSiteSystemPrompt();
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  const fileId = typeof body.fileId === "string" ? body.fileId : null;
  if (fileId) {
    const identity = userId ? { userId } : anonId ? { anonymousSessionId: anonId } : null;
    const fileContext = identity ? await loadFileContext(fileId, identity) : null;
    if (fileContext && "content" in fileContext) {
      messages.push({
        role: "system",
        content: `The user attached a file named "${fileContext.name}". Its contents:\n\n${fileContext.content}`,
      });
    } else if (fileContext && "error" in fileContext) {
      messages.push({
        role: "system",
        content: `The user tried to attach "${fileContext.name}" but it couldn't be read (${fileContext.error}). Let them know briefly.`,
      });
    }
  }

  messages.push(...history);

  try {
    const reply = await groqChat(messages);
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof GroqError) {
      console.error("Assistant chat failed:", error.message);
      return NextResponse.json({ error: "The assistant is unavailable right now. Try again shortly." }, { status: 502 });
    }
    throw error;
  }
}
