import "dotenv/config";
import { defineConfig } from "prisma/config";

// Built from decomposed DB_* vars (not a single DATABASE_URL) so that special
// characters in the password don't need manual percent-encoding by hand.
//
// Falls back to a placeholder when the vars are unset rather than throwing —
// `prisma generate` (used in CI to produce the client) only reads the schema
// and never opens a connection, so it shouldn't require real credentials.
// `migrate`/`db push`/`studio` DO connect, and will fail with a clear
// connection error at that point if the placeholder is still in place.
function databaseUrl(): string {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ?? "3306";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !password || !database) {
    return "mysql://placeholder:placeholder@localhost:3306/placeholder";
  }

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl(),
  },
});
