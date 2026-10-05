# Tidetime

Self-hosted appointment scheduling for a single company with multiple services and multiple providers. Customers pick a service, choose a provider or let the system assign one, and book an open slot. Your team manages availability, bookings, and customers from one dashboard.

Tidetime is open source and runs on your own server. There is no hosted plan, no per-seat pricing, and no third-party analytics.

![Screen recording of a visitor booking an Intro Call on Tidetime, choosing the service, picking a date and time, entering their details, seeing the confirmation, and receiving the confirmation email.](docs/media/booking.gif)

![The Tidetime Bookings page in the staff dashboard, listing the new 10:00 am Intro Call booked by Alex Taylor with Demo Owner, marked Confirmed.](docs/media/admin.png)

## Features

- **Services and providers.** Define services with their own duration, location, intake questions, and an optional manual-confirmation step. Assign one or more providers to each service.
- **Provider assignment.** Customers can choose a provider, or Tidetime assigns the least-busy available one. Bookings are created inside a database transaction so two customers cannot take the same slot at once. Staff can still place a manual booking over existing ones from the dashboard calendar.
- **Availability.** Each provider sets their own weekly hours. A provider can keep several named schedules, but only the one marked default is used for bookings. Admins can manage team availability, daily booking caps, and group events with multiple seats.
- **Public booking pages.** A clean service list and a step-by-step booking flow, shown in the customer's own time zone.
- **Booking lifecycle.** Confirm, reschedule, and cancel, with email notifications at each step and attendee RSVP links.
- **Calendars.** Providers can connect Google Calendar or Microsoft 365 for busy-time conflict checks, and Google Meet links are generated automatically for services whose location is Google Meet, when the provider has Google connected.
- **Email delivery.** Send through any SMTP server or a Microsoft 365 mailbox. Administrators configure both and choose the active one.
- **Customers.** A directory of everyone who has booked, with per-customer history and CSV export.
- **Webhooks.** Signed, Zapier-compatible webhooks fire on booking events, with retries and backoff.
- **Branding and custom domain.** Set your company name, logo, and brand colour. Point your own domain at the server and Tidetime obtains and renews an HTTPS certificate for it automatically.
- **Security.** Password login with optional two-factor authentication, session management, spam protection on public forms, rate limiting, and a configurable data-retention window.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) and React 19
- TypeScript
- [Drizzle ORM](https://orm.drizzle.team) with PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) and Radix UI
- Nodemailer for email, Google APIs and Microsoft Graph for calendars
- Docker and [Caddy](https://caddyserver.com) for production deployment

## Quick start

You need Node.js 20 or newer and a PostgreSQL database. `docker compose up -d` starts one locally.

```bash
git clone https://github.com/Sulaiman-Dauda/Tidetime.git tidetime
cd tidetime
cp .env.example .env
```

The example file is set up for production, so edit `.env` before going on. Delete the `NODE_ENV=production` line, set `APP_URL=http://localhost:3100`, and set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/tidetime` (the database `docker compose up -d` starts). The secrets can stay empty in development.

```bash
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:3100/setup` to create the company and its owner account. From there, invite teammates under **Members** and assign them to services as providers under **Services**.

To try a demo company instead, skip `/setup` and seed the empty database. It creates a sample service with two providers, and you sign in as `owner@example.com` with the password `password123`. Do not run both: the seed adds its own company, and setup is closed once users exist.

```bash
npm run db:seed
```

## Configuration

Copy `.env.example` to `.env` and fill in the values. The essentials:

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Yes | Public URL of the instance, used in links and emails. |
| `APP_NAME` | No | Product name used in browser titles, in emails, and in authenticator apps. The company name set in Settings does not replace it there. Defaults to Tidetime. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `AUTH_SECRET` | Yes | Random value of at least 32 characters. Encrypts stored credentials and two-factor secrets, and signs OAuth state, RSVP links and spam-check tokens. Sessions do not depend on it. |
| `CRON_SECRET` | Yes | Random value of at least 32 characters. Protects the background jobs endpoint. |
| `POSTGRES_PASSWORD` | Prod | Password for the bundled PostgreSQL container in the production Compose file. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Enable Google Calendar and Google Meet. |

Generate a secret with `openssl rand -base64 32`. SMTP and Microsoft 365 email are set up in the dashboard after the app is running, not in the environment file.

In production the app validates its configuration on boot and refuses to start with a missing or weak secret.

## Production

On a fresh Linux server (root or sudo), one command installs everything (Docker, secrets, firewall, the stack) and prints the address when it is live:

```bash
curl -fsSL https://raw.githubusercontent.com/Sulaiman-Dauda/Tidetime/main/install.sh | bash
```

Prefer to do it by hand? The production Compose file runs PostgreSQL, the standalone Next.js server, a background jobs worker, and Caddy:

```bash
cp .env.example .env
# Fill APP_URL, POSTGRES_PASSWORD, AUTH_SECRET, and CRON_SECRET.
# Compose builds DATABASE_URL itself from POSTGRES_PASSWORD.
docker compose -f docker-compose.prod.yml up -d --build
```

This builds the image from source. To run the published image instead, which also updates the same way as an installer setup, add `TIDETIME_IMAGE=ghcr.io/sulaiman-dauda/tidetime:latest` to `.env` and start with `docker compose -f docker-compose.prod.yml pull` followed by `docker compose -f docker-compose.prod.yml up -d`.

The app container applies database migrations before it starts. The jobs worker calls the protected cron endpoint on an interval to handle webhook retries and data retention. The application port stays bound to localhost so all remote traffic passes through Caddy, so the instance is reached at `http://<your-server-ip>` (or `https://<your-domain>` once a domain is attached).

For domain setup, backups, Microsoft 365 email, and upgrade notes, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Access model

Team members are managed under **Members**, each with one of four roles:

- **Owner** (full control, including settings, integrations, and transferring ownership).
- **Admin** (everything except transferring ownership, including the service catalogue, availability, all bookings, and settings; can invite, change, and remove schedulers and members, but not other admins).
- **Scheduler** (a front-desk role for managing all bookings and customers, with no access to the catalogue, members, or settings; not meant to take bookings, but the service editor does not stop you assigning one as a provider, and an assigned scheduler becomes bookable).
- **Member** (a bookable provider who manages their own availability, bookings, and calendar connection).

A provider is a member assigned to a service. These boundaries are enforced in the server queries and mutations, not only in the interface.

## Integrations

**Google Calendar and Meet.** Google needs the instance on a custom domain with HTTPS, because it rejects plain-HTTP and IP-address redirect URIs. Once the domain is live (**Settings, Domain**), create Web application OAuth credentials in Google Cloud with the redirect URI `https://<your-domain>/api/google-calendar/callback`, add the client ID and secret to your environment, and restart. Providers then connect their own calendars from the dashboard.

**Microsoft 365.** Register an app in Microsoft Entra and connect it from **Dashboard, Connections**. The same registration covers both mailbox sending and calendar conflict checks. Full steps are in the deployment notes.

**Zapier and generic webhooks.** Add a Catch Hook URL under **Dashboard, Connections, Zapier webhooks** and pick which events to send. Each delivery includes:

- `Content-Type: application/json`
- `X-Tidetime-Signature-256: sha256=<HMAC>`
- a JSON body of `{ triggerEvent, createdAt, payload }`

Each webhook gets a random signing secret when you add it. The dashboard does not show it yet; read it from the `secret` column of the `webhooks` table to verify the signature.

Targets must be publicly routable HTTP or HTTPS URLs, redirects are not followed, requests time out after ten seconds, and failed deliveries retry with backoff.

## Development

```bash
npm run dev          # start the dev server on port 3100
npm run check        # lint, type-check, unit tests, and a production build
npm run test         # unit tests only
npm run test:e2e     # end-to-end tests (Playwright)
npm run db:studio    # browse the database with Drizzle Studio
```

To reset a local database to a clean state:

```bash
npm run db:reset -- --confirm <database_name>
npm run db:migrate
npm run db:seed
```

The reset command refuses to run in production mode, against remote hosts, or without a matching database name.

## Contributing

Issues and pull requests are welcome. Please run `npm run check` before opening a pull request, and see [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security reports go through [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
