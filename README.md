# bongshai.cloud

Premium personal cloud storage: 25GB free for registered accounts, 2GB free
with no account at all. Next.js 16 (App Router) + Prisma 7 + MySQL, deployed
on InterServer cPanel via Passenger.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: MySQL/MariaDB via Prisma 7's driver-adapter architecture
  (`@prisma/adapter-mariadb`) — no native query-engine binary, so there's no
  Windows-dev/Linux-prod mismatch risk
- **Auth**: Auth.js v5 — email/password (bcryptjs) + Google + GitHub OAuth,
  JWT sessions
- **Storage**: local disk on the server (`STORAGE_ROOT`), sharded by a
  server-generated UUID — never derived from client input, never under a
  web-servable path
- **Styling**: Tailwind CSS v4, a dark/glass design system, Radix UI
  primitives

## Local development

```bash
npm install
npm run db:generate   # generate the Prisma client
npm run db:push       # sync schema to the DB (see note below on migrations)
npm run dev
```

Copy `.env.example` to `.env` and fill in real values — the app connects
directly to the production MySQL database over Remote MySQL for local dev
(no separate staging DB). See `DEPLOY.md` for what each variable is.

### Why `db push` instead of `migrate dev`

The DB user on this host can't create a shadow database (`CREATE DATABASE`
isn't granted), which `prisma migrate dev` requires. Until that's set up
(a second empty cPanel database granted to the same user, wired up via
`shadowDatabaseUrl`), schema changes go through `db push`, which doesn't
need a shadow DB but also doesn't produce versioned migration files.

### MyISAM vs InnoDB

This host's MySQL defaults new tables to `MyISAM`, which has **no foreign
key enforcement and no transaction support** — silently breaking both the
cascade-delete behavior in the schema and the quota-locking transactions in
`lib/quota.ts`. `npm run db:push` always runs
`scripts/ensure-innodb.ts` afterward to convert every table to InnoDB; don't
run `prisma db push` directly without that step after adding new tables.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (`output: 'standalone'`) |
| `npm run db:push` | Push schema + ensure InnoDB |
| `npm run db:studio` | Prisma Studio |
| `npm run grant-unlimited -- someone@example.com` | Give an account unlimited storage (`--revoke` to undo) |
| `npm run cleanup-anonymous` | Delete unclaimed anonymous files older than 30 days (also takes a day count: `-- 7`) |

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for the full cPanel/Passenger deployment guide.
GitHub Actions (`.github/workflows/build.yml`) builds and type-checks on
every push to `main` and uploads a ready-to-upload deploy bundle as an
artifact.
