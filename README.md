# Tide Time Lite

A focused booking app for one company with multiple services and multiple providers.

## What remains

- Company services with configurable duration, location, questions, and confirmation
- Provider membership, per-provider availability, and optional customer provider choice
- Least-busy automatic provider assignment with transactional double-booking protection
- Public service list and booking flow
- Booking lifecycle, email notifications, Google Calendar, and Google Meet
- Customer booking history
- Signed outgoing Zapier-compatible webhooks with retries
- Company branding and basic access control

## Intentionally removed

Payments, polls, routing forms, reviews, categories, temporary links, personal booking pages,
public API keys/API v1, CRM, AI/licensing, Microsoft/CalDAV calendars, Zoom/Daily, travel and
blocked-period engines, multi-attendant/collective events, group seats, recurring series,
analytics dashboards, embeds/PWA, and the command palette.

## Local development

Requires Node.js 20+ and PostgreSQL.

```bash
cp .env.example .env
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:3100/setup` to create the company owner. Setup creates the company and
the first provider. Add providers under **Providers**, then assign them to services.

Earlier pre-release databases are intentionally unsupported. To replace an old local prototype
database, confirm its exact database name and then apply the clean baseline:

```bash
npm run db:reset -- --confirm tidetime_lite
npm run db:migrate
npm run db:seed
```

The reset command refuses production mode, remote database hosts, system databases, and
non-matching confirmation names.

## Production

```bash
cp .env.example .env
# Fill APP_URL, DATABASE_URL, POSTGRES_PASSWORD, AUTH_SECRET, and CRON_SECRET.
docker compose -f docker-compose.prod.yml up -d --build
```

The app container runs the database migration before startup. The jobs worker calls the protected
cron endpoint for webhook retries and retention cleanup. See [deployment notes](docs/DEPLOYMENT.md).

## Zapier webhooks

An administrator adds the Zapier Catch Hook URL under **Connections → Zapier webhooks** and
chooses booking events. Deliveries include:

- `Content-Type: application/json`
- `X-Tidetime-Signature-256: sha256=<HMAC>`
- `{ triggerEvent, createdAt, payload }`

Targets are restricted to publicly routable HTTPS/HTTP URLs, redirects are not followed, calls
time out after ten seconds, and failed deliveries retry with backoff.

## Verification

```bash
npm run check
npm run test:e2e
```

License: MIT.
