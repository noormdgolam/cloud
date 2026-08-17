# Deploying to cloud.bongshai.com (InterServer cPanel)

This app develops directly against the production database (`abongsha_cloud`)
over Remote MySQL — there is no separate staging database.

**SSH is not available on this account** (confirmed blocked at the
account level even with SSH keys showing "Authorized" in cPanel's SSH
Access page — a support-ticket-only restriction). All deploys go over FTP;
all server-side scripts run from a local checkout against the remote DB
instead of on the server itself.

## One-time setup

### 1. Create the subdomain

cPanel → **Domains** → create `cloud.bongshai.com` pointing at a new document
root, e.g. `~/cloud-bongshai-web` (this will NOT be the Node app root — see
below).

### 2. Create the Node.js app

cPanel → **Setup Node.js App** → **Create Application**:

- Node.js version: 22.x (Next.js 16 requires 20.9+)
- Application mode: Production
- Application root: `cloud-bongshai-app` (a folder under your home directory,
  separate from `public_html`)
- Application URL: `cloud.bongshai.com`
- Application startup file: `server.js`

Don't start it yet — there's nothing deployed there.

### 3. Create local disk storage, outside any web-servable path

This must NOT be inside the app root or `public_html` — Passenger serves
anything under `<app-root>/public/` directly, bypassing Node entirely, so
uploaded files must live somewhere that path can never reach. Create
`/home/<cpanel-user>/cloud_storage` via cPanel's File Manager (no SSH
available to `mkdir` it directly).

### 4. Set environment variables

cPanel → **Setup Node.js App** → your app → environment variables. These are
all server-only (no rebuild needed when changing them — just a restart)
unless noted otherwise.

**Core:**

| Variable | Value |
|---|---|
| `DB_HOST` | `localhost` (the app runs on the same server as the DB) |
| `DB_PORT` | `3306` |
| `DB_USER` | `abongsha_ass` |
| `DB_PASSWORD` | *(the real password)* |
| `DB_NAME` | `abongsha_cloud` |
| `STORAGE_ROOT` | `/home/<cpanel-user>/cloud_storage` |
| `AUTH_SECRET` | *(same value as local `.env`, or generate a fresh one — see below)* |
| `AUTH_URL` | `https://cloud.bongshai.com` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud Console OAuth client — for sign-in only |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth App |
| `CRON_SECRET` | shared secret gating every `/api/cron/*` route, called externally by GitHub Actions (`.github/workflows/*-cron.yml`) since this host has no reliable in-process scheduler |

**Third-party service keys** (all optional — the app degrades gracefully,
not fatally, when one's missing; see each row):

| Variable | Value | If missing |
|---|---|---|
| `GROQ_API_KEY` | groq.com → API key — powers the AI assistant | that feature errors, nothing else affected |
| `CONVERTAPI_TOKEN` | convertapi.com — docx/xlsx ⇄ PDF, image → PDF conversion | convert-format tool errors, nothing else affected |
| `VIRUSTOTAL_API_KEY` | virustotal.com → account → API key (free tier) | uploads still work, files just get `scanStatus: SKIPPED` instead of scanned |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | your cPanel email account | forgot-password emails fail to send |

**Google Drive/Photos import** — a *dedicated* OAuth client, deliberately
separate from `AUTH_GOOGLE_ID`/`SECRET` above (those are for sign-in; this is
for the Picker's token-request flow, which never uses a client secret at
all — isolates blast radius if either client's scopes/verification status
ever need to change):

| Variable | Value |
|---|---|
| `GOOGLE_IMPORT_CLIENT_ID` | Cloud Console → new OAuth client → Web application |
| `GOOGLE_PICKER_API_KEY` | Cloud Console → API key, restricted by HTTP referrer to `https://cloud.bongshai.com/*` |
| `GOOGLE_PROJECT_NUMBER` | Cloud Console dashboard (a number, not the project ID string) |

Requires enabling "Google Picker API", "Google Drive API", and "Google
Photos Picker API" in that project's API Library. Feature is gated to any
*logged-in* user (not gated by plan). If the OAuth consent screen is still
in **Testing** status, only manually-added test users can complete the
flow — publish to Production (Audience tab → Publish App) to open it to
everyone; expect a one-time "Google hasn't verified this app" interstitial
on each account's first consent until formal verification is completed.

**NOWPayments** (crypto/USDT checkout, settling to a RedotPay wallet):

| Variable | Value |
|---|---|
| `NOWPAYMENTS_API_KEY` | dashboard.nowpayments.io → Store Settings → API keys |
| `NOWPAYMENTS_IPN_SECRET` | Store Settings → IPN secret key |
| `REDOTPAY_USDT_TRC20_ADDRESS` | your RedotPay USDT (TRC20) deposit address — payments settle straight here, a wrong value sends funds to the wrong wallet, irreversibly |
| `NOWPAYMENTS_API_BASE` | **leave unset in production** — defaults to `https://api.nowpayments.io/v1`. Only set this to `https://api-sandbox.nowpayments.io/v1` (with sandbox-specific API key/IPN secret, both different from production) when deliberately testing against their sandbox |

NOWPayments enforces a minimum payment amount (empirically ~$2-5 depending
on market conditions, confirmed too high for amounts under ~$10) — plans
priced below `MIN_CRYPTO_USD_CENTS` (`src/lib/billing/thresholds.ts`, $10)
don't show a crypto option in the UI at all.

**SSLCommerz** (direct Visa/Mastercard checkout, priced in USD — covers the
price range NOWPayments' minimum locks out):

| Variable | Value |
|---|---|
| `SSLCOMMERZ_STORE_ID` | SSLCommerz merchant panel |
| `SSLCOMMERZ_STORE_PASSWORD` | SSLCommerz merchant panel |
| `SSLCOMMERZ_BASE_URL` | `https://securepay.sslcommerz.com` (production) or `https://sandbox.sslcommerz.com` (sandbox — separate store_id/password from production) |

Session creation (the `createSslcommerzSession` call) is confirmed working
against a real sandbox account — correct field names, correct base URL,
real `GatewayPageURL` returned. The callback/webhook side
(`validateSslcommerzPayment`, signature/amount cross-check) is still
unverified end-to-end — that needs either a full sandbox checkout
completion (their test card: `4111111111111111`, exp `12/25`, CVV `111`)
or trusting the code review until the first real transaction.

**bKash** (BDT mobile wallet checkout):

| Variable | Value |
|---|---|
| `BKASH_USERNAME` / `BKASH_PASSWORD` / `BKASH_APP_KEY` / `BKASH_APP_SECRET` | bKash merchant portal |
| `BKASH_BASE_URL` | e.g. `https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout` (sandbox) / `https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout` (production) |

Not yet verified against a real merchant sandbox — see the caveat comment
at the top of `src/lib/billing/bkash.ts`.

Generate a fresh `AUTH_SECRET` for production rather than reusing the dev one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Update OAuth callback URLs

- **Google Cloud Console** → the *sign-in* OAuth client → Authorized redirect
  URIs → add `https://cloud.bongshai.com/api/auth/callback/google`
- **GitHub** → OAuth App settings → Authorization callback URL → either add
  a second OAuth app for production, or update the existing one to
  `https://cloud.bongshai.com/api/auth/callback/github`

### 6. Verify backup coverage

Local-disk storage means a server disk failure is data loss unless
InterServer's backup system (commonly JetBackup) is confirmed to include
`~/cloud_storage` specifically — it may default to only `public_html` and
databases. **Ask InterServer support to confirm this explicitly before
relying on it.**

## Every deploy after that

There is no CI/CD pipeline wired up — deploys are driven from a local
checkout via the FTP tooling in `deploy-tool/` (git-ignored; holds FTP
credentials in its own `.env`, kept out of the main repo deliberately):

```bash
npm run build                                    # writes .next/
rm -rf ftp-deploy && mkdir -p ftp-deploy
cp -r .next/standalone/. ftp-deploy/
mkdir -p ftp-deploy/.next
cp -r .next/static ftp-deploy/.next/static
cp -r public ftp-deploy/public
cp .env ftp-deploy/.env                          # server-only vars matching your local .env
node deploy-tool/deploy2.mjs                      # syncs .next/ + public/ over FTP
```

1. Wait for the literal string **`ALL DONE`** in the script's output — a
   background-task "completed (exit code 0)" notification is **not**
   sufficient proof of success on its own; this host's FTP has produced
   false-positive-looking timeouts mid-transfer before. Only `ALL DONE`
   (not `SYNC FAILED`) means it's safe to proceed.
2. Verify the remote `BUILD_ID` matches the local one:
   `node deploy-tool/check-buildid.mjs`.
3. If the Prisma schema changed: `npm run db:push` (talks directly to the
   remote DB, independent of the FTP sync — safe to run before, during, or
   after the file sync completes).
4. Restart the app. **Important**: neither restart mechanism on this stack
   cleanly replaces the old worker process — confirmed by direct
   before/after process counts (a single restart went 24 → 33 processes,
   zero reduction) via both the UI's Restart button and
   `node deploy-tool/restart.mjs` (touches `tmp/restart.txt`, the standard
   Passenger convention). Every restart leaks a duplicate; enough of them
   in one session silently accumulates until the account's process limit
   is hit (real incident on 2026-08-16 — see below). Batch multiple
   changes into one restart rather than one per change, for this reason
   alone. Only ever restart once the FTP sync's literal `ALL DONE` is
   confirmed — restarting into a directory that's still mid-sync compounds
   the problem.
   - **Proper sequence, now that Terminal access works** (see below): in
     cPanel's Terminal, `ps aux | grep lsnode` to find the current live
     process's PID, `kill <pid>` to explicitly terminate it, confirm it's
     gone with another `ps aux | grep lsnode`, *then* click Restart in
     Setup Node.js App. This is the closest thing to a clean restart
     available without real SSH.
   - **Fallback if Terminal isn't available**: just click Restart in the
     UI. It still leaks like everything else, but the automated cleanup
     cron job (below) mops that up on its own schedule.
5. Confirm `https://cloud.bongshai.com` loads at normal speed (well under a
   second — 15+ second responses mean something's wrong, e.g. a DB
   connection-pool issue or the account hitting its process limit; check
   cPanel's account Statistics panel for "Number Of Processes" if so).

### Process-leak cleanup (automated safety net)

`deploy-tool/cleanup_orphans.sh` is deployed to `<app-root>/_cron/` and run
every 15 minutes by a cPanel **Cron Job** (Advanced section — a completely
different, always-available feature from SSH/Terminal, needs neither):

```
0,15 * * * * /bin/bash /home/abongsha/cloud-bongshai-app/_cron/cleanup_orphans.sh -f
```

It finds every process matching this app in `ps aux` and kills all but the
newest — logs to `_cron/cleanup_orphans.log` next to itself, fetchable via
`deploy-tool/check-cron-log.mjs`. **One real gotcha already hit and fixed**:
the process name CloudLinux shows in `ps aux` is
`lsnode:/home/abongsha/bongshai-node-app/`, **not**
`lsnode:/home/abongsha/cloud-bongshai-app/`, despite the app's actual
filesystem/FTP root genuinely being `cloud-bongshai-app` (confirmed by
every deploy landing correctly there all session, and by stderr log
paths). The internal Node.js Selector process identifier and the real app
directory name are two different things — don't assume they match; verify
with a live `ps aux | grep lsnode` before trusting any process-matching
script or command.

**cPanel's browser-based Terminal** (Advanced section) is a real, working
capability, genuinely separate from SSH — it isn't blocked by the same
account-level shell restriction that blocks `ssh` directly. The one catch:
it needs a free process slot to even open, so if the account is already
pinned at its process limit, Terminal itself fails with
`cagefs_enter: Unable to fork` — a chicken-and-egg state that needs
InterServer support to clear, not fixable from inside Terminal at that
point.

## Maintenance scripts

The Passenger deploy bundle (`ftp-deploy/`, built from `.next/standalone`)
is a pruned build — it doesn't include `tsx`, `prisma`, or the `scripts/`
folder's dev tooling. Since there's no SSH to run anything server-side
anyway, all one-off/admin scripts (granting unlimited quota, checking DB
state, etc.) are run **locally** against the same remote production DB
`.env` already points at — see `scripts/*.ts` for examples, and always
clean up throwaway test accounts/data created this way afterward.

## Troubleshooting

- **App won't start / 503, or errors mentioning a specific env var**: check
  the app's log in cPanel's Node.js Selector page, or fetch it directly via
  `deploy-tool/fetch-stderr.mjs`. Most often a missing environment variable
  — the app is designed to degrade gracefully (log-and-continue) for
  optional third-party keys, but core ones (`DB_*`, `AUTH_SECRET`) are hard
  requirements.
- **OAuth redirect_uri_mismatch**: `AUTH_URL` isn't set to the `https://`
  production URL, or the callback URL wasn't added on the provider's side.
- **Uploads fail immediately**: `STORAGE_ROOT` doesn't exist or isn't
  writable by the Node process — check the path and permissions.
- **Static assets 404**: the deploy bundle's `.next/static/` or `public/`
  didn't get copied into `ftp-deploy/` before syncing — `output: 'standalone'`
  doesn't include them by default, the manual copy step above does this.
- **A burst of quick requests returns a "please wait, verifying your
  request" page**: that's an anti-bot/WAF challenge layer in front of the
  site, not a routing bug — it triggers on rapid bursts (e.g. testing
  scripts hitting the site repeatedly). A single, well-spaced request
  afterward returns the real response. Not something to work around, just
  something to expect.
- **cPanel's own web UI / API port refuses automated (headless-browser)
  access**: deliberate anti-automation bot-detection (checks
  `navigator.webdriver`) on InterServer's side — not something to try to
  bypass, even with a valid API token. Env var changes currently require a
  real, manual browser session in cPanel.
