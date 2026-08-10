import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaMariaDb({
    host: requireEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 5),
  });

  return new PrismaClient({ adapter });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Reuse a single client across hot reloads in dev and across route handler
// invocations in production, instead of opening a new connection pool per request.
export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
