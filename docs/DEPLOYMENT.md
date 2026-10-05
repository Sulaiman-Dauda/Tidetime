# Deployment

Tidetime is deployed with Docker. The fastest path is the install script; the manual Compose steps below give you full control.

## Install script

On a fresh Linux server (as root, or a user with sudo):

```bash
curl -fsSL https://raw.githubusercontent.com/Sulaiman-Dauda/Tidetime/main/install.sh | bash
```

The script installs everything it needs (Docker, git, and openssl if missing), adds a swap file on low-memory hosts, opens firewall ports 80 and 443, then downloads the project, generates the required secrets, writes a `.env` file, starts the stack, and waits until it is healthy. It uses a prebuilt image published to the GitHub Container Registry (`ghcr.io/sulaiman-dauda/tidetime`) and only builds from source when a pull is not possible. It prints the address to open when done, for example `http://<your-server-ip>`. Review the script before running it if you prefer.

The instance is reachable on port 80 through Caddy (`http://<your-server-ip>`, no port suffix); the application's own port stays bound to localhost. Attach a domain for HTTPS (see [Custom domain and HTTPS](./ADMIN_GUIDE.md#custom-domain-and-https)); a bare IP cannot be issued a certificate.

## Required configuration

Set `APP_URL`, `DATABASE_URL`, a URL-safe random `POSTGRES_PASSWORD`, a random `AUTH_SECRET`
of at least 32 characters, and a separate `CRON_SECRET` of at least 32 characters. The
production Compose file refuses to start when `POSTGRES_PASSWORD` is empty.
Set Google OAuth credentials only if providers will connect Google Calendar.
Outgoing email is configured in the administrator UI after startup. Tidetime
can retain both a generic SMTP connection and a Microsoft 365 connection; the
administrator explicitly chooses which one is active.

## Microsoft 365 email

Microsoft 365 email uses delegated Microsoft Graph access for one connected
work or school mailbox. The same app registration also lets providers connect
Outlook calendars for conflict checks.

Client secrets, the SMTP password, OAuth tokens and two-factor secrets are
encrypted with a key derived from `AUTH_SECRET`. Changing it makes all of them
unreadable: re-enter the SMTP password and reconnect every integration. Users
with two-factor authentication cannot complete sign-in until their two-factor
secret is cleared in the database. RSVP links in emails already sent also stop
working.

1. Sign in to the Microsoft Entra admin center and create an **App registration**
   using **Accounts in this organizational directory only**.
2. Under **Authentication**, add a **Web** platform and paste the Callback
   URL displayed in **Dashboard → Connections → Email delivery → Microsoft 365**.
   If providers will connect Outlook calendars, add a second redirect URI,
   `<APP_URL>/api/microsoft-calendar/callback` (with your custom domain in
   place of `APP_URL` if you use one).
3. Under **API permissions → Microsoft Graph → Delegated permissions**, add
   `Mail.Send` and `User.Read`, plus `Calendars.Read` if providers will connect
   Outlook calendars. `openid`, `profile`, `email`, and `offline_access` are
   requested automatically during sign-in.
4. Under **Certificates & secrets**, create a client secret. Copy the secret
   **Value** immediately; the Secret ID is not the credential.
5. From the registration's **Overview** page, copy its Directory (tenant) ID
   and Application (client) ID. Paste those and the client-secret value into
   Tidetime, save, and select **Connect Microsoft 365**.
6. Sign in as the dedicated sending mailbox, send a test email, then select
   **Use Microsoft 365**.

The registered redirect URI must exactly match Tidetime's displayed callback
URL, including `https`, hostname, and path. Configure the final `APP_URL` or
custom domain before connecting. Use a dedicated licensed/shared sending
mailbox appropriate to the organisation's Exchange configuration, rotate the
client secret before it expires, and reconnect after changing the app
registration or public domain.

Do not expose PostgreSQL publicly. The production Compose file binds the application port to
localhost so remote traffic passes through Caddy, which normalises client-address headers before
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

## Updates

When a newer GitHub release exists than the version you run, admins see an **Update available** card at the foot of the sidebar with the old and new version numbers. Release notes are on the [GitHub Releases](https://github.com/Sulaiman-Dauda/Tidetime/releases) page. The check is cached for 30 minutes, and nothing updates on its own.

If you installed with the install script, its `.env` sets `TIDETIME_IMAGE=ghcr.io/sulaiman-dauda/tidetime:latest`. Update from the install directory:

```bash
cd /path/to/tidetime          # the install directory
git pull
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

The `latest` image follows the main branch, so it can include changes that are not yet in a release.

If you followed the manual Compose steps, set `TIDETIME_IMAGE=ghcr.io/sulaiman-dauda/tidetime:latest` in `.env` so you run the published image and update with the commands above. Without it, Compose builds the image from source as `tidetime:local`, `pull` cannot fetch a new version, and you update with:

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Without the updater service below, the card's **Update now** button copies the pull and restart command to your clipboard. Browsers block the clipboard on a plain-HTTP address, so run the commands yourself.

Your data is kept: everything, including uploaded logos and avatars, is stored in PostgreSQL, whose named volume survives the restart. Back up first anyway (see below). Migrations run when the app starts; see [Database migrations](#database-migrations).

### Enabling one-click updates (optional)

To make the dashboard's **Update now** button perform the update for you, enable the updater service. It runs a small helper container with access to the Docker socket, which is **host-root-equivalent**, so only enable it if you accept that trade-off. The updater pulls the image and restarts the stack. It does not run `git pull`, and it cannot update a source build.

Run it alongside the production stack, from the install directory:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.updater.yml up -d
```

The app talks to the updater over a private volume; it never gets Docker access itself. To disable it again:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.updater.yml stop updater
docker compose -f docker-compose.prod.yml up -d
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

## Database migrations

Migrations in `drizzle/` are applied in order each time the app container starts, so an
existing database is upgraded in place. Back up before every upgrade. There is no upgrade path
from the prototypes that came before v0.1.0.
