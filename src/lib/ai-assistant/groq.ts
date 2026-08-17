import "server-only";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Fast free-tier model — good fit for a support-chat widget where latency
// matters more than frontier-model reasoning depth. Overridable per
// environment without a code change if Groq deprecates/renames a model.
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class GroqError extends Error {}

// Groq exposes an OpenAI-compatible Chat Completions endpoint — no SDK
// needed for a single non-streaming call.
export async function groqChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    throw new GroqError(`Groq chat completion failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new GroqError(`Groq response missing message content: ${JSON.stringify(data)}`);
  }
  return content;
}
