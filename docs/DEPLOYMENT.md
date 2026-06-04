# Deployment

This guide covers the recommended production deployment patterns for Tidetime.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- a stable `APP_URL`
- a strong `AUTH_SECRET`
- SMTP configured via Settings UI (optional)
- optional Stripe credentials in Settings if you want paid bookings
- optional `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` if you want Google Calendar sync

## Required production environment

At minimum, set:

```env
NODE_ENV=production
APP_URL=https://your-domain.example
DATABASE_URL=postgres://...
AUTH_SECRET=<32+ random characters>
NEXT_TELEMETRY_DISABLED=1
```

Generate a secret with:

```bash
openssl rand -base64 32
```

If you want Google Calendar sync, also set:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Docker Compose deployment

Use the provided production compose file:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

That stack runs:

- PostgreSQL
- the app server
- a reminder worker loop

### What the app service does

On startup the app service:

1. waits for PostgreSQL
2. runs database migrations
3. starts the Next.js production server

## Manual deployment

### 1. Install dependencies

```bash
npm ci
```

### 2. Build the app

```bash
npm run build
```

### 3. Apply migrations

```bash
npm run db:migrate
```

### 4. Start the server

```bash
npm run start
```

### 5. Run the reminder worker on a schedule

For example, every 5 minutes:

```bash
*/5 * * * * cd /srv/tidetime && npm run jobs:reminders >> /var/log/tidetime-reminders.log 2>&1
```

## Reverse proxy guidance

Terminate TLS in a reverse proxy such as Nginx, Caddy, or Traefik.

Recommended upstream settings:

- force HTTPS
- forward `X-Forwarded-*` headers correctly
- keep `APP_URL` aligned with the external HTTPS origin
- avoid caching dynamic authenticated pages

## Health checks

Use:

```text
GET /api/health
```

A healthy instance returns HTTP 200 with a successful database check. If the database is unavailable, the endpoint returns HTTP 503.

## Email (SMTP)

Configure SMTP via the Settings UI (navigate to Settings → Email after logging in as admin).
Credentials are encrypted at rest in the database.

If no SMTP is configured, emails are logged to the console instead of being sent.

## Google Calendar

To enable Google Calendar sync:

1. set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the app environment
2. restart the app
3. connect each provider account in **Settings → Google Calendar**

Tidetime reads busy time from the selected Google calendars and creates booking events on the chosen destination calendar.

## Stripe

Stripe credentials can be stored and tested via the Settings UI (Settings → Stripe).
The publishable key, secret key, and webhook secret are encrypted at rest. Paid-booking checkout is live for services with **Require payment** enabled.

For production, configure your Stripe webhook to send `payment_intent.*` events to:

```text
POST /api/stripe/webhook
```

## Backups

Back up PostgreSQL regularly. At minimum:

- schedule logical backups (`pg_dump`) or physical snapshots
- test restores periodically
- keep backups encrypted and off-host

Example logical backup from Docker Compose:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-tidetime} \
  | gzip > tidetime-$(date +%F).sql.gz
```

Example restore into a fresh database:

```bash
gunzip -c tidetime-2026-06-04.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-tidetime}
```

After every restore, verify:

- you can log in as an admin
- `/api/health` returns `200`
- a public booking page loads successfully
- reminder jobs still run on schedule

## Upgrades

Recommended upgrade process:

1. review the changelog
2. pull the new release
3. run `npm ci`
4. run `npm run build`
5. run `npm run db:migrate`
6. restart the app and reminder worker

## Operational checklist

Before going live, confirm:

- [ ] `APP_URL` matches the public HTTPS origin
- [ ] `AUTH_SECRET` is long and unique
- [ ] PostgreSQL backups are configured
- [ ] SMTP configured and tested (Settings → Email)
- [ ] Stripe credentials and webhook delivery are verified if you plan to use paid bookings
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set if you plan to use Google Calendar sync
- [ ] the reminder worker is scheduled
- [ ] `/api/health` is monitored
