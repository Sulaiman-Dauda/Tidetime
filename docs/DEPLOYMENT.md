# Deployment

> Audience: self-hosters and technical administrators.
>
> If Tidetime is already running and you only need to use the product, start with [Getting Started](./GETTING_STARTED.md) instead.

This guide explains how to run Tidetime in production. There are three deployment paths. The **one-command installer is recommended** for most people; Docker Compose is the manual container path; and a plain Node.js setup is available if you manage your own runtime.

If something goes wrong, see [Troubleshooting](./TROUBLESHOOTING.md).

## What you need

Minimum requirements:

- A Linux host (or any machine with Docker) with a public IP or domain
- For the installer / Docker paths: Docker Engine with the Compose v2 plugin
- For the manual Node path: Node.js 20+ and PostgreSQL 14+ (PostgreSQL 18 is what the bundled images use)
- A stable public URL for the app
- A strong `AUTH_SECRET` (32+ characters)

### Server sizing

| Resource | Minimum | Recommended | Why |
| --- | --- | --- | --- |
The default install **pulls a prebuilt image** from GHCR — nothing is compiled on your server, so requirements are modest. Building from source (the installer's fallback, or `TIDETIME_BUILD=1`) is the demanding path.

| Resource | Minimum (prebuilt image, default) | If building from source | Why |
| --- | --- | --- | --- |
| CPU | 1 vCPU | 1 vCPU (2 recommended) | Pull-based installs barely touch the CPU. A source build compiles the app: 10–20 minutes on 1 vCPU, roughly 5 on 2. |
| RAM | 1 GB | 1 GB + swap (the installer sizes it) | The running stack (app + worker + PostgreSQL) idles at ~500 MB. A source build peaks at ~3 GB (measured); the installer checks RAM + swap against the ~5 GB it needs and offers a right-sized swapfile (2–4 GB). 4 GB of RAM builds without swap. |
| Disk | 15 GB SSD | 25 GB SSD | OS + Docker + the pulled images use roughly 6–8 GB. Source builds add a few GB of build cache. The rest is headroom for the PostgreSQL volume, backups, and logs (capped at ~60 MB per service). |
| OS | Any Linux that runs Docker | same | The installer can install Docker itself via get.docker.com on any mainstream distribution. |

In practice: the **smallest tier at most cloud providers (1 vCPU / 1 GB, ~$5–6/mo) runs Tidetime comfortably** with the default pull-based install — no swap tricks needed. You only need the bigger numbers if you deliberately build from source (e.g. a fork or an architecture without a published image).

Optional but common additions, all configured **in the app** after first launch (not in `.env`):

- SMTP for real email delivery
- Stripe for paid bookings
- Google / Microsoft / Zoom / Daily / HubSpot for calendar sync and meeting links

## How configuration works

Tidetime's `.env` file holds only **bootstrap config** — the few values needed to start the process safely. Everything else (SMTP, Stripe, and every calendar/meeting integration) is configured inside the app under **Dashboard → Integrations** (Calendars, Video, CRM, Payments, Email) and stored **encrypted in the database**. When a value exists both in `.env` and in the database, the database wins.

This means you do not put SMTP or Stripe credentials in `.env`. You bring the app up first, then finish setup through the UI.

## Path A: One-command installer (recommended)

`install.sh` lives at the repository root. It checks for Docker (and offers to install it on Linux), fetches the source, auto-generates a hardened `.env` (random `POSTGRES_PASSWORD`, a 64-char `AUTH_SECRET`, a `CRON_SECRET`, and `APP_PORT`), then **pulls the prebuilt image from GHCR** (`ghcr.io/sulaiman-dauda/tidetime`, published by CI on every release) and launches the full stack with Docker Compose — no compiling on your server. If the pull fails (registry unreachable, a fork without published images, an architecture without one), it automatically falls back to building from source, offering to add swap first on small servers. Database migrations run automatically inside the app container, and it waits until the app reports healthy.

```bash
curl -fsSL https://raw.githubusercontent.com/Sulaiman-Dauda/tidetime/main/install.sh -o install.sh
chmod +x install.sh
./install.sh
```

The installer:

- Installs into `/opt/tidetime` (or `~/tidetime` if `/opt` is not writable), or installs in place if you run it from inside a checkout.
- Generates secrets on first run and **preserves them on re-run** — re-running is the supported upgrade path (it pulls the newest image).
- Runs `docker compose -p tidetime -f docker-compose.prod.yml pull` + `up -d --no-build` (or `up -d --build` in the source-build path).

When it finishes, open the printed URL and go to **`/setup`** to create the owner account.

### Unattended / scripted installs

Override behavior with environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TIDETIME_URL` | auto-detected | Public URL (e.g. `https://book.example.com`). A bare domain is assumed to be `https://`; trailing slash is stripped. |
| `TIDETIME_PORT` | `3000` | Host port to publish the app on. |
| `TIDETIME_DIR` | `/opt/tidetime` or `~/tidetime` | Install directory. |
| `TIDETIME_BRANCH` | `main` | Git branch to deploy. |
| `TIDETIME_IMAGE` | `ghcr.io/sulaiman-dauda/tidetime:latest` | Prebuilt image to pull — point it at a pinned version tag or a fork's registry. |
| `TIDETIME_BUILD` | unset | Set to `1` to skip the prebuilt image and compile from source on the server. |
| `TIDETIME_YES` | unset | Set to `1` to assume "yes" to all prompts (non-interactive). |

Example, fully unattended:

```bash
TIDETIME_URL=https://book.example.com TIDETIME_YES=1 ./install.sh
```

## Path B: Docker Compose (manual)

Use this if you want to drive Compose yourself.

```bash
cp .env.example .env
# Edit .env and set at least:
#   APP_URL            your public URL, no trailing slash
#   AUTH_SECRET        32+ random chars (openssl rand -base64 32)
#   POSTGRES_PASSWORD  a strong database password
#   APP_PORT           host port to publish (optional, default 3000)
docker compose -f docker-compose.prod.yml up -d --build
```

The stack (`docker-compose.prod.yml`) runs three services:

- **postgres** — `postgres:18-alpine`, data in the `tidetime_pgdata` volume.
- **app** — the Next.js server. Its start command is `npm run db:migrate:runtime && npm run start`, so **migrations run automatically** before the server boots.
- **reminders** — a sidecar that runs the background job runner on a loop (see [Background jobs](#background-jobs)).

Important details specific to this path:

- **Do not set `DATABASE_URL`.** Compose derives it from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` and injects it into the app and reminders services. Setting it yourself here is unnecessary and can cause mismatches.
- **Port mapping.** The container always listens on port **3100** internally. Compose publishes it to the host on `${APP_PORT:-3000}`. So you reach the app on the host at `APP_PORT` (default `3000`), not 3100.
- The Postgres volume is mounted at `/var/lib/postgresql` (not `/var/lib/postgresql/data`) on purpose — see [Troubleshooting](./TROUBLESHOOTING.md).

After the stack is healthy, open `http://<host>:<APP_PORT>` and go to **`/setup`**.

## Path C: Manual Node.js

Use this if you run Node and PostgreSQL yourself (systemd, a process manager, etc.). In this path **you set `DATABASE_URL`** explicitly.

### 1. Install dependencies

```bash
npm ci
```

### 2. Build

```bash
npm run build
```

`AUTH_SECRET` is intentionally **not required at build time** — it is a runtime-only secret. The build runs with placeholder `APP_URL`/`DATABASE_URL` and no `AUTH_SECRET` so real secrets never end up in build artifacts.

### 3. Apply migrations

```bash
npm run db:migrate
```

This reads `.env` (`tsx --env-file=.env`), so make sure your `.env` has a valid `DATABASE_URL` first.

### 4. Start the server

```bash
npm run start
```

`next start` serves on `PORT` (default **3000**).

### 5. Run the background jobs

The manual path does not include the reminders sidecar, so you must run the job runner yourself. The preferred option is the long-running worker:

```bash
npm run jobs:worker
```

See [Background jobs](#background-jobs) for all three options.

## Required production environment

When `NODE_ENV=production`, Tidetime validates its environment at startup and **exits immediately** if a required value is missing or unsafe. The required runtime values are:

```env
NODE_ENV=production
APP_URL=https://your-domain.example      # no trailing slash; cannot be the localhost default
DATABASE_URL=postgres://user:pass@host:5432/tidetime   # manual path only; derived in Compose
AUTH_SECRET=<32+ random characters>      # cannot be the dev default
```

Generate a secret with:

```bash
openssl rand -base64 32
```

### Full environment reference

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | Set to `production`. Drives the startup safety checks. |
| `APP_URL` | yes (prod) | Public URL. Must be a valid URL and not the localhost default, or the process exits. Trailing slash is stripped. Used for OAuth redirects and email links. |
| `DATABASE_URL` | yes (manual path) | PostgreSQL connection string. In Docker Compose it is **derived** from `POSTGRES_*`; do not set it there. Exits if left at the default in production. |
| `AUTH_SECRET` | yes (prod runtime) | Session key and at-rest encryption key for stored integration secrets. Must be ≥ 32 chars and not the dev default. Skipped during `next build`. Rotating it invalidates sessions and makes previously stored integration secrets undecryptable. |
| `APP_NAME` | no | Display name across UI/emails. Default `Tidetime`. |
| `CRON_SECRET` | no | Only needed if you trigger jobs via the HTTP `/api/cron` endpoint. |
| `APP_PORT` | no (Compose only) | Host port published by Compose, default `3000`, mapped to container port `3100`. Not read by the app itself. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose only | Configure the bundled Postgres and build the derived `DATABASE_URL`. |
| `REMINDER_INTERVAL_SECONDS` | no (Compose only) | Loop interval for the reminders sidecar, default `300`. |
| `WORKER_INTERVAL_MS` | no | Tick interval for `jobs:worker`, default `30000` (minimum `5000`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Optional fallback; usually set in **Dashboard → Integrations**. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | no | Optional fallback. |
| `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | no | Optional fallback. |
| `DAILY_API_KEY` / `DAILY_SUBDOMAIN` | no | Optional fallback (account-level key, no OAuth). |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` | no | Optional fallback. |
| `OPENAI_API_KEY` | no | AI features. |
| `LICENSE_KEY` / `LICENSE_PUBLIC_KEY` | no | Leave blank for the open-source Community edition. |

Remember: SMTP, Stripe, and integration credentials belong in the app's settings, not in `.env`.

## Background jobs

Reminders, review requests, webhook deliveries, and retention cleanup all run together through a single entrypoint (`runDueJobs`). Each run takes a PostgreSQL **advisory lock**, so overlapping runs — even a worker and an external scheduler firing at the same time — never process the same job twice. You can drive it in any of three ways:

1. **Long-running worker** (preferred for non-Docker):

   ```bash
   npm run jobs:worker
   ```

   Ticks every `WORKER_INTERVAL_MS` (default 30s, minimum 5s). Run it as a systemd service or sidecar alongside the app.

2. **One-shot per tick** (what the Docker `reminders` service does):

   ```bash
   npm run jobs:reminders
   ```

   Processes everything due once, then exits. In Compose this is looped every `REMINDER_INTERVAL_SECONDS` (default 300). With the Docker stack this is already running — no extra setup needed.

3. **HTTP trigger** (good for external schedulers — cron, GitHub Actions, cloud scheduler):

   ```text
   POST /api/cron      Authorization: Bearer $CRON_SECRET
   ```

   `GET` is also accepted. Returns `503` if `CRON_SECRET` is unset and `401` on a mismatch. Example crontab entry:

   ```bash
   */5 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://YOUR_APP/api/cron
   ```

The Docker Compose stack already runs option 2 for you. Only the manual Node path requires you to wire up jobs yourself.

## Reverse proxy and HTTPS

In production, put Tidetime behind a reverse proxy such as Nginx, Caddy, or Traefik to terminate HTTPS and forward traffic to the app port.

Recommended setup:

- Force HTTPS.
- Forward `X-Forwarded-*` headers correctly.
- Point the proxy upstream at the host's `APP_PORT` (Docker) or `PORT` (manual Node).
- Keep `APP_URL` exactly aligned with the public HTTPS address (no trailing slash).
- Avoid caching logged-in dynamic pages.

## Health checks

Tidetime exposes a readiness probe:

```text
GET /api/health
```

- `200` with `{ "status": "ok", "database": "up" }` — the app can reach PostgreSQL.
- `503` with `{ "status": "degraded", "database": "down" }` — the app is up but the database check failed.

Use it for uptime monitors and container health checks. (The bundled Docker images already wire this into their `HEALTHCHECK`.)

## Email setup

Configure email **inside the app** at **Integrations → Email**. You can store and test the SMTP host, port, username, password, and from address. If SMTP is not configured, Tidetime logs email output to the server console instead of sending it.

## Calendar and meeting integrations

Calendar sync and meeting-link providers (Google, Microsoft, Zoom, Daily, HubSpot) are configured in **Dashboard → Integrations**. You can either paste the credentials directly in the UI or set the corresponding `*_CLIENT_ID` / `*_CLIENT_SECRET` env vars as a fallback. Each OAuth provider also needs its redirect URI registered on the provider side, using your `APP_URL` as the base (see the comments in `.env.example`). Connect each user's account from the in-app integrations screen.

## Stripe setup

Stripe is configured entirely in the app at **Integrations → Payments** (publishable key, secret key, webhook secret) — there are no Stripe `.env` variables. For production, configure Stripe to send `payment_intent.*` events to:

```text
POST /api/stripe/webhook
```

Paid bookings only work when the Stripe keys are valid, the webhook is configured correctly, and the service itself is set to require payment.

## Backups

Back up PostgreSQL regularly: schedule backups, store them securely, keep copies off the host, and test restores periodically.

Example backup from the Docker Compose stack:

```bash
docker compose -p tidetime -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-tidetime} \
  | gzip > tidetime-$(date +%F).sql.gz
```

Example restore into the running database:

```bash
gunzip -c tidetime-2026-06-04.sql.gz | \
  docker compose -p tidetime -f docker-compose.prod.yml exec -T postgres \
  psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-tidetime}
```

After a restore, verify that you can sign in, `/api/health` returns `200`, a public booking page loads, and the background jobs still run.

## Logs

The Compose stack caps container logs at 20 MB × 3 files per service (json-file driver), so logs can't fill the host disk. View them with:

```bash
docker compose -p tidetime -f docker-compose.prod.yml logs -f app
```

If you run the manual Node path instead, put the app behind a process manager that rotates logs (systemd journal, pm2 with logrotate, etc.).

## Upgrades

- **Installer / Docker path:** re-run `./install.sh` (it preserves your secrets and pulls the newest image), or do it manually: `docker compose -p tidetime -f docker-compose.prod.yml pull && docker compose -p tidetime -f docker-compose.prod.yml up -d --no-build`. Migrations run automatically on app start.
- **Manual Node path:**
  1. Review the changelog and release notes.
  2. Pull the new version.
  3. `npm ci`
  4. `npm run build`
  5. `npm run db:migrate`
  6. Restart the app and the jobs worker.
  7. Run one test booking.

## Production checklist

Before going live, confirm:

- [ ] `APP_URL` matches the real public HTTPS address, with no trailing slash
- [ ] `AUTH_SECRET` is 32+ chars, unique, and private
- [ ] `DATABASE_URL` is correct (manual path) or `POSTGRES_*` are set (Compose)
- [ ] PostgreSQL backups are scheduled and a restore has been tested
- [ ] Email is configured and tested in **Integrations → Email** if you need customer emails
- [ ] Stripe is configured in **Integrations → Payments** if you need paid bookings
- [ ] Calendar/meeting integrations are connected if you need them
- [ ] The background jobs are running (the reminders sidecar in Docker, or `jobs:worker`/cron in the manual path)
- [ ] `/api/health` is being monitored
- [ ] One complete test booking has been completed

## Related guides

- [Troubleshooting](./TROUBLESHOOTING.md)
- [Admin Guide](./ADMIN_GUIDE.md)
- [Architecture](./ARCHITECTURE.md)
