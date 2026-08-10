# Deploying to cloud.bongshai.com (InterServer cPanel)

This app develops directly against the production database (`abongsha_cloud`)
over Remote MySQL — there is no separate staging database. Once the app is
live on the server itself, point it at `DB_HOST=localhost` instead of the
public IP (faster, and Remote MySQL access can be locked back down to just
your own dev IP afterward).

## One-time setup

### 1. Create the subdomain

cPanel → **Domains** → create `cloud.bongshai.com` pointing at a new document
root, e.g. `~/cloud-bongshai-web` (this will NOT be the Node app root — see
below).

### 2. Create the Node.js app

cPanel → **Setup Node.js App** → **Create Application**:

- Node.js version: 22.x (Next.js 16 requires 20.9+)
- Application mode: Production
- Application root: `cloud-bongshai` (a folder under your home directory,
  separate from `public_html`)
- Application URL: `cloud.bongshai.com`
- Application startup file: `server.js`

Don't start it yet — there's nothing deployed there.

### 3. Create local disk storage, outside any web-servable path

Over SSH/Terminal:

```bash
mkdir -p ~/cloud_storage
```

This must NOT be inside `cloud-bongshai` (the app root) or `public_html` —
Passenger serves anything under `<app-root>/public/` directly, bypassing
Node entirely, so uploaded files must live somewhere that path can never
reach.

### 4. Set environment variables

cPanel → **Setup Node.js App** → your app → environment variables:

| Variable | Value |
|---|---|
| `DB_HOST` | `localhost` (the app runs on the same server as the DB) |
| `DB_PORT` | `3306` |
| `DB_USER` | `abongsha_ass` |
| `DB_PASSWORD` | *(the real password)* |
| `DB_NAME` | `abongsha_cloud` |
| `STORAGE_ROOT` | `/home/<cpanel-user>/cloud_storage` |
| `AUTH_SECRET` | *(same value as local `.env`, or generate a new one — see below)* |
| `AUTH_URL` | `https://cloud.bongshai.com` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from Google Cloud Console |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | from GitHub OAuth Apps |

Generate a fresh `AUTH_SECRET` for production rather than reusing the dev one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Update OAuth callback URLs

- **Google Cloud Console** → your OAuth client → Authorized redirect URIs →
  add `https://cloud.bongshai.com/api/auth/callback/google`
- **GitHub** → OAuth App settings → Authorization callback URL → either add
  a second OAuth app for production, or update the existing one to
  `https://cloud.bongshai.com/api/auth/callback/github`

### 6. Verify backup coverage

Local-disk storage means a server disk failure is data loss unless
InterServer's backup system (commonly JetBackup) is confirmed to include
`~/cloud_storage` specifically — it may default to only `public_html` and
databases. **Ask InterServer support to confirm this explicitly before
relying on it.**

### 7. Full checkout for cron/maintenance scripts

The Passenger deploy bundle (below) is a pruned "standalone" build — it
doesn't include `tsx` or the `scripts/` folder's dev tooling. Keep a
**separate full checkout** for maintenance scripts:

```bash
cd ~
git clone https://github.com/noormdgolam/cloud.git cloud-bongshai-scripts
cd cloud-bongshai-scripts
npm install
cp ~/cloud-bongshai/.env .env   # or recreate it with the same DB_*/STORAGE_ROOT values
```

Then add a cPanel **Cron Job**:

```
0 4 * * *  cd ~/cloud-bongshai-scripts && npm run cleanup-anonymous >> ~/cleanup.log 2>&1
```

(4am daily; adjust as you like. Re-run `git pull && npm install` here
whenever scripts change.)

## Every deploy after that

1. Push to `main` — GitHub Actions (`.github/workflows/build.yml`) builds,
   type-checks, lints, and uploads a `deploy-bundle` artifact.
2. Download the artifact, extract it.
3. Upload its contents into the cPanel app root (`~/cloud-bongshai`),
   overwriting what's there — via File Manager, or `rsync`/`scp` if you have
   SSH access set up for it.
4. If the Prisma schema changed: run `npm run db:push` from your local
   machine (or the full checkout above) against the production DB — same
   database dev has been using all along.
5. cPanel → **Setup Node.js App** → your app → **Restart**.
6. Confirm `https://cloud.bongshai.com` loads and AutoSSL has issued a
   certificate (cPanel → SSL/TLS Status).

## Troubleshooting

- **App won't start / 503**: check the app's log in cPanel's Node.js Selector
  page. Most often a missing environment variable.
- **OAuth redirect_uri_mismatch**: `AUTH_URL` isn't set to the `https://`
  production URL, or the callback URL wasn't added on the provider's side.
- **Uploads fail immediately**: `STORAGE_ROOT` doesn't exist or isn't
  writable by the Node process — check the path and permissions.
- **Static assets 404**: the deploy bundle's `.next/static/` or `public/`
  didn't get copied in — `output: 'standalone'` doesn't include them by
  default, the GitHub Actions workflow does this copy step explicitly.
