# Deployment

This guide covers the recommended production deployment patterns for Tidetime.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- a stable `APP_URL`
- a strong `AUTH_SECRET`
- optional SMTP credentials for real email delivery
- optional Stripe credentials for paid bookings

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

## Email delivery

If SMTP variables are omitted, Tidetime logs emails to the console instead of sending them. This is useful in development, but production deployments should configure SMTP.

## Stripe

To enable paid bookings, configure both:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Do not set only one of them. Tidetime rejects partial Stripe configuration at startup.

## Backups

Back up PostgreSQL regularly. At minimum:

- schedule logical backups (`pg_dump`) or physical snapshots
- test restores periodically
- keep backups encrypted and off-host

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
- [ ] SMTP works end-to-end
- [ ] Stripe webhook delivery is verified if payments are enabled
- [ ] the reminder worker is scheduled
- [ ] `/api/health` is monitored
