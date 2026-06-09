# Troubleshooting

> Audience: admins, self-hosters, and contributors.
>
> If you are a regular user, you may still find this helpful, but you should also check the [FAQ](./FAQ.md) and [Getting Started](./GETTING_STARTED.md).

This guide covers common problems and the fastest fixes. For full setup details, see [Deployment](./DEPLOYMENT.md).

## Quick checks first

Before digging deeper, confirm these basics:

- `APP_URL` matches the real public address, with no trailing slash
- PostgreSQL is reachable
- `AUTH_SECRET` is set in production and is at least 32 characters
- The latest database migrations have been applied (automatic in the Docker/installer paths)
- Email, calendar, or Stripe settings are configured in the app if you rely on them

## Problem: app container exits immediately / crash-loops with "❌ Unsafe production environment"

This is the **most common boot failure**. On startup in production, Tidetime validates its environment and exits if anything required is missing or unsafe. The log lists exactly which checks failed, for example:

```text
❌ Unsafe production environment:
- APP_URL must be set explicitly in production.
- AUTH_SECRET must be at least 32 characters in production.
```

### Fix

Set the missing/invalid values in `.env`:

- `APP_URL` — must be a valid URL and **not** the localhost default.
- `DATABASE_URL` — required in the **manual Node** path. In Docker Compose it is derived from `POSTGRES_*`, so do not set it there; instead make sure `POSTGRES_PASSWORD` (etc.) are set.
- `AUTH_SECRET` — must be **≥ 32 characters** and not the development default. Generate one with `openssl rand -base64 32`.

Then restart (Docker: `docker compose -p tidetime -f docker-compose.prod.yml up -d`).

## Problem: "Can't reach the app on port 3100"

The container **listens on 3100 internally**, but Docker Compose publishes it on the host at `APP_PORT` (default **3000**). Browse to `http://<host>:<APP_PORT>`, not `:3100`.

For the manual Node path there is no 3100 at all — `next start` serves on `PORT` (default **3000**).

## Problem: `/api/cron` returns `503`

This means `CRON_SECRET` is **not set** in the app's environment, so the HTTP job trigger is disabled. This is distinct from the health-check `503` below.

### Fix

Set `CRON_SECRET` in `.env`, restart the app, and call the endpoint with a matching bearer token:

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://YOUR_APP/api/cron
```

A `401` instead means the token you sent does not match `CRON_SECRET`.

> Note: if you use the bundled Docker `reminders` sidecar or the `jobs:worker` process, you do not need `CRON_SECRET` at all — it is only for the HTTP trigger.

## Problem: `/api/health` returns `503`

### What it usually means

The app is running but cannot complete its database check (`{ "status": "degraded", "database": "down" }`).

### Fix

Check that:

- PostgreSQL is running
- `DATABASE_URL` is correct (or, in Compose, the `POSTGRES_*` values match)
- The database accepts connections from the app
- Network or container settings are not blocking access

A healthy response is `200` with `{ "status": "ok", "database": "up" }`.

## Problem: PostgreSQL container won't start (volume mount)

The bundled Compose files mount the Postgres volume at `/var/lib/postgresql`, **not** `/var/lib/postgresql/data`. This is intentional: the `postgres:18` image stores data in a version-specific subdirectory and its entrypoint **refuses to start** if you mount `/data` directly. Do not "fix" the mount path to `/var/lib/postgresql/data`.

## Problem: build logs show placeholder `APP_URL`/`DATABASE_URL` and no `AUTH_SECRET`

This is **intentional and safe**. `AUTH_SECRET` is a runtime-only secret and is skipped during `next build`; `APP_URL` and `DATABASE_URL` use throwaway placeholders for the build. This keeps real secrets out of image layers. The real values are read at runtime from `.env`.

## Problem: database query errors or missing columns

Examples:

- `column "round_robin_mode" does not exist`
- `column "deposit_amount" does not exist`
- a failed query on `event_types`

### What it usually means

The application code is newer than the database schema.

### Fix

In the Docker/installer paths, migrations run automatically on app start — restart the app container to re-run them. In the manual Node path, run:

```bash
npm run db:migrate
```

Then restart the app.

## Problem: booking page says "Booking temporarily unavailable"

### What it usually means

Public bookings are disabled for the workspace.

### Fix

Go to **Settings → Booking** and check **Disable public bookings**. While it is on, public pages, slot lookups, and booking forms stay unavailable.

## Problem: emails are not being delivered

### Check these first

- Verify SMTP settings in **Integrations → Email**
- Use **Test connection** inside the app
- Confirm the sender address is valid
- Check spam or junk folders

### Important note

If SMTP is not configured, Tidetime logs emails to the server console instead of sending them. Configure SMTP in the app (not in `.env`) to enable real delivery.

## Problem: Stripe payment tests are failing

### Check these first

- The publishable key is correct
- The secret key is correct
- The webhook secret is correct
- The Stripe webhook endpoint is configured

Stripe is configured in **Integrations → Payments**, where the publishable key, secret key, and webhook secret are stored together. Paid bookings only work when Stripe can reach `/api/stripe/webhook` and the service is set to require payment.

## Problem: a calendar or meeting integration will not connect

### Check these first

- The provider's credentials are set in **Dashboard → Integrations** (or the matching `*_CLIENT_ID` / `*_CLIENT_SECRET` env vars)
- The OAuth app's redirect URI on the provider side uses your `APP_URL` as the base
- The app was restarted if you changed env values
- You are connecting from **Dashboard → Integrations**

Supported providers include Google, Microsoft, Zoom, Daily, and HubSpot. See the redirect-URI list in `.env.example`.

## Problem: TypeScript complains about `.next/types`

This mostly affects contributors and local development.

### Fix

```bash
npm run typecheck
```

The typecheck script regenerates route types before TypeScript runs.

## Problem: I changed the code, but behavior still looks old

1. Restart the app.
2. Rebuild if needed with `npm run build` (or rebuild the image: `docker compose -p tidetime -f docker-compose.prod.yml up -d --build`).
3. Confirm the latest code is actually deployed.
4. Confirm the latest migrations were applied.

## Quick health check

```text
GET /api/health
```

- `200` = app and database are talking normally
- `503` = app is up, but database access failed

## Still stuck?

Use the guide that best matches your problem:

- [Admin Guide](./ADMIN_GUIDE.md)
- [Deployment](./DEPLOYMENT.md)
- [API Reference](./API.md)
- [FAQ](./FAQ.md)
