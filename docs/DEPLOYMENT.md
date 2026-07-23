# Deployment

## Required configuration

Set `APP_URL`, `DATABASE_URL`, a URL-safe random `POSTGRES_PASSWORD`, a random `AUTH_SECRET`
of at least 32 characters, and a separate `CRON_SECRET` of at least 32 characters. The
production Compose file intentionally refuses to start with a default database password.
Set Google OAuth credentials only if providers will connect Google Calendar.
SMTP is configured in the administrator UI after startup.

Do not expose PostgreSQL publicly. Terminate TLS at Caddy or another trusted reverse proxy and
back up the PostgreSQL volume before upgrades.

## Containers

`docker-compose.prod.yml` runs PostgreSQL, the standalone Next.js server, a small cron worker,
and Caddy. The app runs the checked-in Drizzle migration before it starts. The cron worker sends
`Authorization: Bearer <CRON_SECRET>` to `POST /api/cron` for webhook retries and retention cleanup.

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app jobs
```

## Release checks

Before deployment run `npm ci && npm run check`, then test setup, provider invitation, service
creation, provider-specific booking, automatic-provider booking, cancellation, Google Calendar,
email, and a Zapier catch hook against a staging database.

## Pre-release database policy

This pre-release build has one clean baseline migration and intentionally provides no upgrade
path from earlier prototypes. Use a new empty PostgreSQL database. This policy can change once
the first production release creates a compatibility commitment.
