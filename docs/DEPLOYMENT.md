# Deployment

## Required configuration

Set `APP_URL`, `DATABASE_URL`, a URL-safe random `POSTGRES_PASSWORD`, a random `AUTH_SECRET`
of at least 32 characters, and a separate `CRON_SECRET` of at least 32 characters. The
production Compose file intentionally refuses to start with a default database password.
Set Google OAuth credentials only if providers will connect Google Calendar.
Outgoing email is configured in the administrator UI after startup. TideTime
can retain both a generic SMTP connection and a Microsoft 365 connection; the
administrator explicitly chooses which one is active.

## Microsoft 365 email

Microsoft 365 email uses delegated Microsoft Graph access for one connected
work or school mailbox. Client secrets and OAuth tokens are encrypted at rest
using `AUTH_SECRET`; changing `AUTH_SECRET` invalidates the stored credentials.

1. Sign in to the Microsoft Entra admin center and create an **App registration**
   using **Accounts in this organizational directory only**.
2. Under **Authentication**, add a **Web** platform and paste the App Callback
   URL displayed in **Dashboard → Connections → Email delivery → Microsoft 365**.
3. Under **API permissions → Microsoft Graph → Delegated permissions**, add
   `Mail.Send` and `User.Read`. `openid`, `profile`, `email`, and
   `offline_access` are requested automatically during sign-in.
4. Under **Certificates & secrets**, create a client secret. Copy the secret
   **Value** immediately; the Secret ID is not the credential.
5. From the registration's **Overview** page, copy its Directory (tenant) ID
   and Application (client) ID. Paste those and the client-secret value into
   TideTime, save, and select **Connect Microsoft 365**.
6. Sign in as the dedicated sending mailbox, send a test email, then select
   **Use Microsoft 365**.

The registered redirect URI must exactly match TideTime's displayed callback
URL, including `https`, hostname, and path. Configure the final `APP_URL` or
custom domain before connecting. Use a dedicated licensed/shared sending
mailbox appropriate to the organisation's Exchange configuration, rotate the
client secret before it expires, and reconnect after changing the app
registration or public domain.

Do not expose PostgreSQL publicly. The production Compose file binds the application port to
localhost so remote traffic passes through Caddy, which normalizes client-address headers before
the application applies rate limits. Terminate TLS at Caddy or another trusted reverse proxy and
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

## Backups and restore

Create a compressed logical backup before every upgrade and copy it off the application host:

```bash
mkdir -p backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "backups/tidetime-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Test restoration regularly against a separate empty database. The following command overwrites the
named restore database, so never point it at the live database:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'createdb -U "$POSTGRES_USER" tidetime_restore_test'
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d tidetime_restore_test --clean --if-exists --no-owner --no-acl' \
  < backups/your-backup.dump
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d tidetime_restore_test -c "select count(*) from users;"'
```

## Release checks

Before deployment run `npm ci && npm run check`, then test setup, provider invitation, service
creation, provider-specific booking, automatic-provider booking, cancellation, Google Calendar,
email, and a Zapier catch hook against a staging database.

## Pre-release database policy

This pre-release build has one clean baseline migration and intentionally provides no upgrade
path from earlier prototypes. Use a new empty PostgreSQL database. This policy can change once
the first production release creates a compatibility commitment.
