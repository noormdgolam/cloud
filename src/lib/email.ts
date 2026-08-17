import "server-only";
import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function transport() {
  if (cachedTransport) return cachedTransport;
  const port = Number(process.env.SMTP_PORT ?? 465);
  cachedTransport = nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port,
    secure: port === 465, // 465 = implicit TLS; 587 would need secure:false + STARTTLS
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
  });
  return cachedTransport;
}

export async function sendMail(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
  await transport().sendMail({
    from: process.env.SMTP_FROM ?? requireEnv("SMTP_USER"),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}
