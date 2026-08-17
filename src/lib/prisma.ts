import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

declare global {
  var __prisma: ReturnType<typeof createClient> | undefined;
}

// @prisma/adapter-mariadb has a documented bug (github.com/prisma/prisma
// issues #28964, #28612, #28879) where its internal connection pool can end
// up in a state it never recovers from on its own — every subsequent query
// fails instantly with "pool timeout... active=0 idle=0" even though the
// database is perfectly reachable. It's been observed here after the pool
// sits idle for an extended period. The only known recovery is discarding
// the pool and building a new one, so isPoolDead() below detects that exact
// signature and the query extension evicts the cached singleton — the next
// request builds a fresh client/pool automatically instead of every request
// failing until someone manually restarts the app.
function isPoolDead(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("pool timeout") && message.includes("active=0 idle=0");
}

function createClient() {
  const adapter = new PrismaMariaDb({
    host: requireEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 5),
    // connectTimeout bounds how long a single connection attempt can hang;
    // idleTimeout recycles pooled connections proactively instead of
    // trusting them to still be good. Mitigates how often the pool goes bad
    // in the first place; isPoolDead()/the extension below handles it when
    // it happens anyway.
    connectTimeout: 10_000,
    idleTimeout: 60,
  });

  const client = new PrismaClient({ adapter });

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (err) {
          if (isPoolDead(err) && globalThis.__prisma) {
            globalThis.__prisma = undefined;
          }
          throw err;
        }
      },
    },
  });
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
// Re-reads globalThis.__prisma on every call (rather than caching the
// reference) so the eviction inside createClient()'s query extension — set
// when the pool is detected dead — actually results in a rebuilt client on
// the next call instead of continuing to hand out the stale one.
function getClient() {
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
