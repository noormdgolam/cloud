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
function getClient(): PrismaClient {
  if (!globalThis.__prisma) {
    globalThis.__prisma = createClient();
  }
  return globalThis.__prisma;
}

// Lazy on purpose: `next build` imports route modules to collect their
// config (dynamic/runtime exports) without ever calling the handlers, so
// constructing the real client (which requires DB_* env vars) at module
// scope would crash the build itself. Only the first actual property
// access — which only happens inside a request — creates the client.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
