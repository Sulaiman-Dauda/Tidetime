# Tidetime

Self-hosted appointment scheduling for a single company with multiple services and multiple providers. Customers pick a service, choose a provider or let the system assign one, and book an open slot. Your team manages availability, bookings, and customers from one dashboard.

Tidetime is open source and runs on your own server. There is no hosted plan, no per-seat pricing, and no third-party analytics.

## Features

- **Services and providers.** Define services with their own duration, location, intake questions, and confirmation message. Assign one or more providers to each service.
- **Provider assignment.** Customers can choose a provider, or Tidetime assigns the least-busy available one. Bookings are created inside a database transaction so the same slot is never double-booked.
- **Availability.** Each provider sets their own weekly hours across one or more schedules. Admins can manage team availability, daily booking caps, and group events with multiple seats.
- **Public booking pages.** A clean service list and a step-by-step booking flow, shown in the customer's own time zone.
- **Booking lifecycle.** Confirm, reschedule, and cancel, with email notifications at each step and attendee RSVP links.
- **Calendars.** Providers can connect Google Calendar or Microsoft 365 for busy-time conflict checks, and Google Meet links are generated automatically when Google is connected.
- **Email delivery.** Send through any SMTP server or a Microsoft 365 mailbox. Administrators configure both and choose the active one.
- **Customers.** A directory of everyone who has booked, with per-customer history and CSV export.
- **Webhooks.** Signed, Zapier-compatible webhooks fire on booking events, with retries and backoff.
- **Branding and custom domain.** Set your company name, logo, and brand color. Point your own domain at the server and Tidetime obtains and renews an HTTPS certificate for it automatically.
- **Security.** Password login with optional two-factor authentication, session management, spam protection on public forms, rate limiting, and a configurable data-retention window.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) and React 19
- TypeScript
- [Drizzle ORM](https://orm.drizzle.team) with PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) and Radix UI
- Nodemailer for email, Google APIs and Microsoft Graph for calendars
- Docker and [Caddy](https://caddyserver.com) for production deployment

## Quick start

You need Node.js 20 or newer and a PostgreSQL database.

```bash
cp .env.example .env
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:3100/setup` to create the company and its owner account. From there, add providers under **Providers** and assign them to services under **Services**.

To load a demo company with a sample service and provider:

```bash
npm run db:seed
```

## Configuration

Copy `.env.example` to `.env` and fill in the values. The essentials:

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Yes | Public URL of the instance, used in links and emails. |
| `APP_NAME` | No | Display name shown before a company is configured. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `AUTH_SECRET` | Yes | Random value of at least 32 characters. Signs sessions and encrypts stored credentials. |
| `CRON_SECRET` | Yes | Random value of at least 32 characters. Protects the background jobs endpoint. |
| `POSTGRES_PASSWORD` | Prod | Password for the bundled PostgreSQL container in the production Compose file. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Enable Google Calendar and Google Meet. |

Generate a secret with `openssl rand -base64 32`. SMTP and Microsoft 365 email are set up in the dashboard after the app is running, not in the environment file.

In production the app validates its configuration on boot and refuses to start with a missing or weak secret.

## Production

The production Compose file runs PostgreSQL, the standalone Next.js server, a background jobs worker, and Caddy for HTTPS.

```bash
cp .env.example .env
# Fill APP_URL, DATABASE_URL, POSTGRES_PASSWORD, AUTH_SECRET, and CRON_SECRET.
docker compose -f docker-compose.prod.yml up -d --build
```

The app container applies database migrations before it starts. The jobs worker calls the protected cron endpoint on an interval to handle webhook retries and data retention. The application port stays bound to localhost so all remote traffic passes through Caddy.

For domain setup, backups, Microsoft 365 email, and upgrade notes, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Access model

- **Owners and managers** control the service catalog, provider assignments, company settings, and integrations.
- **Providers** manage only their own availability, bookings, and calendar connection. They can see assigned services and accepted teammates but cannot change them.

These boundaries are enforced in the server queries and mutations, not only in the interface.

## Integrations

**Google Calendar and Meet.** Create OAuth credentials in Google Cloud, set the callback to `<APP_URL>/api/google-calendar/callback`, and add the client ID and secret to your environment. Providers then connect their own calendars from the dashboard.

**Microsoft 365.** Register an app in Microsoft Entra and connect it from **Dashboard, Connections**. The same registration covers both mailbox sending and calendar conflict checks. Full steps are in the deployment notes.

**Zapier and generic webhooks.** Add a Catch Hook URL under **Dashboard, Connections, Zapier webhooks** and pick which events to send. Each delivery includes:

- `Content-Type: application/json`
- `X-Tidetime-Signature-256: sha256=<HMAC>`
- a JSON body of `{ triggerEvent, createdAt, payload }`

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
