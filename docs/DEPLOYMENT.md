# Deployment

> Audience: self-hosters and technical administrators.
>
> If Tidetime is already running and you only need to use the product, start with [Getting Started](./GETTING_STARTED.md) instead.

This guide explains how to run Tidetime in production.

## What you need

Minimum requirements:

- Node.js 20+
- PostgreSQL 14+
- a stable public URL for the app
- a strong `AUTH_SECRET`

Optional but common additions:

- SMTP for real email delivery
- Stripe for paid bookings
- Google Calendar credentials for calendar sync

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

## Two ways to deploy Tidetime

### Option 1: Docker Compose

This is the easiest production path if you are comfortable with Docker.

Run:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

That stack runs:

- PostgreSQL
- the web app
- a reminder worker loop

On startup, the app service:

1. waits for PostgreSQL
2. runs database migrations
3. starts the production server

### Option 2: manual deployment

Use this if you want to manage Node.js and PostgreSQL yourself.

#### 1. Install dependencies

```bash
npm ci
```

#### 2. Build the app

```bash
npm run build
```

#### 3. Apply migrations

```bash
npm run db:migrate
```

#### 4. Start the server

```bash
npm run start
```

#### 5. Run the reminder worker on a schedule

Example cron entry every 5 minutes:

```bash
*/5 * * * * cd /srv/tidetime && npm run jobs:reminders >> /var/log/tidetime-reminders.log 2>&1
```

## Reverse proxy and HTTPS

In production, you should put Tidetime behind a reverse proxy such as:

- Nginx
- Caddy
- Traefik

A reverse proxy is the front door that:

- handles HTTPS
- accepts web traffic from the public internet
- forwards requests to the Tidetime app

Recommended setup:

- force HTTPS
- forward `X-Forwarded-*` headers correctly
- keep `APP_URL` exactly aligned with the public HTTPS address
- avoid caching logged-in dynamic pages

## Health checks

Tidetime provides a simple health endpoint:

```text
GET /api/health
```

Expected behavior:

- `200` means the app can reach PostgreSQL
- `503` means the app is running but the database check failed

This is useful for monitors, containers, and uptime checks.

## Email setup

Configure email from inside the app at **Settings → Email**.

You can store and test:

- SMTP host
- port
- username
- password
- from address

If SMTP is not configured, Tidetime logs email output to the console instead of sending it.

## Google Calendar setup

To enable Google Calendar sync:

1. set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the app environment
2. restart the app
3. connect each user's Google account in **Settings → Calendar**

After that, Tidetime can:

- read busy time from selected calendars
- create new booking events in the chosen destination calendar

## Stripe setup

Stripe settings are stored from inside the app at **Settings → Stripe**.

Save:

- publishable key
- secret key
- webhook secret

For production, configure Stripe to send `payment_intent.*` events to:

```text
POST /api/stripe/webhook
```

Paid bookings only work when:

- Stripe keys are valid
- the webhook is configured correctly
- the service itself requires payment

## Backups

Back up PostgreSQL regularly.

At minimum:

- schedule backups
- store them securely
- keep copies off the same host when possible
- test restores from time to time

Example backup from the Docker Compose stack:

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

After a restore, verify that:

- you can sign in
- `/api/health` returns `200`
- a public booking page loads
- reminder jobs still run on schedule

## Upgrades

A safe upgrade flow is:

1. review the changelog and release notes
2. pull the new version
3. run `npm ci`
4. run `npm run build`
5. run `npm run db:migrate`
6. restart the app and reminder worker
7. test one booking flow after the upgrade

## Production checklist

Before going live, confirm:

- [ ] `APP_URL` matches the real public HTTPS address
- [ ] `AUTH_SECRET` is long, unique, and private
- [ ] PostgreSQL backups are set up
- [ ] email is configured and tested if you need customer emails
- [ ] Stripe is configured if you need paid bookings
- [ ] Google Calendar credentials are set if you need calendar sync
- [ ] the reminder worker is running on schedule
- [ ] `/api/health` is being monitored
- [ ] one complete test booking has been completed

## Related guides

- [Troubleshooting](./TROUBLESHOOTING.md)
- [Admin Guide](./ADMIN_GUIDE.md)
- [Architecture](./ARCHITECTURE.md)
