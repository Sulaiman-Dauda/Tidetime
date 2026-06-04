<div align="center">

# 🌊 Tidetime

**Scheduling, perfected.**

A fast, elegant, **open-source scheduling platform** — a lean, self-hostable alternative to Calendly and Cal.com.

[![CI](https://github.com/Sulaiman-Dauda/tidetime/actions/workflows/ci.yml/badge.svg)](https://github.com/Sulaiman-Dauda/tidetime/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/badge/release-v0.1.0-0f172a)](./docs/releases/v0.1.0.md)

[Features](#-features) ·
[Quick start](#-quick-start) ·
[Configuration](#-configuration) ·
[API](#-api) ·
[Deployment](#-deployment) ·
[Contributing](#-contributing)

</div>

---

## ✨ Why Tidetime?

Tidetime focuses on the core scheduling experience:

- **Fast booking pages** with timezone-safe slot generation
- **Simple self-hosting** with Next.js + PostgreSQL
- **Secure defaults** with hashed sessions, encrypted credentials, signed webhooks, and Stripe signature verification
- **Extensible APIs** for webhooks, booking links, and automation
- **Lean architecture** with most business logic isolated in pure, unit-tested modules

## 📌 Current scope

Production-ready **today**:

- Personal and team scheduling
- Public booking pages and embeddable widget
- Google Calendar sync (busy-time read + booking event creation)
- Stripe-powered paid bookings with public attendee checkout
- API keys + REST API
- Webhooks
- Email notifications and reminder worker
- Public booking maintenance mode

Still intentionally limited or out of scope in this repository:

- provider-native Google Meet / Zoom connection flows
- Outlook / CalDAV calendar sync
- hosted file uploads in booking forms

The documentation below reflects the current implementation rather than aspirational features.

## 🚀 Features

| Area              | What you get                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event types**   | Multiple durations, buffers, minimum notice, slot intervals, booking caps, custom booking fields, hidden event types, confirmation-required events |
| **Availability**  | Weekly schedules, date overrides, timezone-aware slot engine, out-of-office support, Google Calendar busy-time sync                               |
| **Booking flow**  | Public profile pages, team booking pages, cancel/reschedule links, ICS invites, embeddable widget                                                 |
| **Teams**         | Shared event types, round-robin scheduling, collective scheduling, memberships and roles                                                           |
| **Payments**      | Stripe-powered attendee checkout for paid services, webhook confirmation, and stale-hold cleanup                                                   |
| **Reviews**       | Post-booking feedback requests; happy ratings routed to your public review page, the rest captured privately                                       |
| **Resources**     | Shared rooms, equipment and assets with capacity-aware double-booking prevention                                                                   |
| **Notifications** | SMTP email delivery (configured in Settings → Email) or console fallback, scheduled reminders                                                      |
| **Automation**    | REST API, booking links, HMAC-signed webhooks, health check endpoint                                                                               |
| **Dashboard**     | Bookings, analytics, availability editor, settings, API keys, links, resources, reviews, teams, maintenance toggle, service ordering controls, first-run service creation flow |
| **Installable**   | PWA manifest and offline-ready service worker for an app-like experience                                                                           |

## 🧱 Tech stack

- **Framework**: Next.js 15 (App Router, React 19, Server Actions)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL + Drizzle ORM
- **Styling**: Tailwind CSS + Radix/shadcn primitives
- **Auth**: Custom session auth using Node crypto primitives
- **Testing**: Vitest

## 📦 Quick start

### Prerequisites

- Node.js **20+**
- PostgreSQL **14+**
- npm **10+**

### 1. Clone and install dependencies

```bash
git clone https://github.com/Sulaiman-Dauda/tidetime.git
cd tidetime
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
openssl rand -base64 32
```

Paste the generated secret into `AUTH_SECRET`.

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 4. Apply migrations

```bash
npm run db:migrate
```

### 5. Seed demo data (optional, development only)

```bash
npm run db:seed
```

This creates:

- email: `demo@tidetime.app`
- password: `password123`
- booking page: `/demo`

> Do **not** use seed data in production.

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On a fresh instance, Tidetime will guide the owner through setup and then straight into **Create your first service**.

## ⚙️ Configuration

Copy `.env.example` to `.env` and set the values below.

| Variable                  | Required      | Default                            | Notes                                               |
| ------------------------- | ------------- | ---------------------------------- | --------------------------------------------------- |
| `NODE_ENV`                | no            | `development`                      | Runtime mode                                        |
| `APP_URL`                 | production    | `http://localhost:3000`            | Public base URL used in emails, metadata, and links |
| `APP_NAME`                | no            | `Tidetime`                         | Display name                                        |
| `DATABASE_URL`            | production    | local Postgres URL                 | PostgreSQL connection string                        |
| `AUTH_SECRET`             | production    | dev fallback only                  | Must be **32+ characters** in production. Used as encryption key for all secrets stored in the database. |
| `GOOGLE_CLIENT_ID`        | optional      | unset                              | Required only if you want Google Calendar sync      |
| `GOOGLE_CLIENT_SECRET`    | optional      | unset                              | Required only if you want Google Calendar sync      |

> **SMTP and Stripe credentials are configured via the Settings UI** (navigate to Settings after logging in). Secrets are encrypted at rest with AES-256-GCM using `AUTH_SECRET` as the key. **Google Calendar still requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the app environment**, after which each provider connects their own Google account in Settings.

### Environment validation

Tidetime fails fast on startup when critical production settings are unsafe or missing, including:

- missing `DATABASE_URL`
- missing or short `AUTH_SECRET`
- invalid `APP_URL`

Google Calendar OAuth credentials are optional. If they are omitted, the Google Calendar connection flow stays unavailable.

## 📜 Scripts

| Command                    | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `npm run dev`              | Start the local dev server                      |
| `npm run build`            | Build for production                            |
| `npm run start`            | Start the built app with `next start`           |
| `npm run start:standalone` | Start the standalone Next.js output             |
| `npm run lint`             | Run ESLint                                      |
| `npm run lint:fix`         | Auto-fix lint issues where possible             |
| `npm run typecheck`        | Run TypeScript without incremental cache        |
| `npm test`                 | Run the test suite                              |
| `npm run test:coverage`    | Run tests with coverage                         |
| `npm run check`            | Run lint + typecheck + tests + production build |
| `npm run db:migrate`       | Apply database migrations                       |
| `npm run db:seed`          | Seed demo data                                  |
| `npm run jobs:reminders`   | Process due reminder jobs once                  |

## 🔌 API

Tidetime exposes a versioned REST API under `/api/v1`.

Authenticate with an API key created in **Dashboard → Settings → API keys**:

```bash
curl http://localhost:3000/api/v1/event-types \
  -H "Authorization: Bearer tt_your_api_key"
```

See [docs/API.md](./docs/API.md) for endpoint details, payloads, pagination, and webhook signing.

### Other operational endpoints

- `GET /api/health` — readiness probe for uptime checks, Docker health checks, and orchestration
- `GET /api/slots` — public slot lookup for personal event types
- `GET /api/slots/team` — public slot lookup for team event types

## 🧩 Embeddable widget

Use the lightweight widget loader from `public/embed.js`:

```html
<div data-tidetime-inline="https://your-app.example/demo/intro"></div>
<script src="https://your-app.example/embed.js" async></script>
```

Popup and floating-button modes are also supported. See the source header in [`public/embed.js`](./public/embed.js) for examples.

## 🚢 Deployment

### Docker Compose

A production compose stack is provided:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

That stack includes:

- PostgreSQL
- the Next.js app
- a reminder worker that processes scheduled reminder jobs on an interval

### Manual deployment

```bash
npm ci
npm run build
npm run db:migrate
npm run start
```

For full deployment and operations guidance, see:

- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

## 🧪 Testing

```bash
npm run check
```

The test suite covers booking fields, analytics, CSV export, API auth helpers, reminders, round-robin logic, payments, RBAC, team availability, reviews, and resource scheduling.

## 🤝 Contributing

Contributions are welcome. Please read:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)

## 🔐 Security

- sessions are stored as hashed opaque tokens
- passwords use `scrypt`
- encrypted credentials use AES-GCM
- webhook deliveries are HMAC-signed
- Stripe webhooks are signature-verified
- security headers are applied globally, with clickjacking protection on sensitive routes

To report a vulnerability, follow [SECURITY.md](./SECURITY.md).

## 🏷️ Releases

- First public open-source release: [v0.1.0 release notes](./docs/releases/v0.1.0.md)
- Release process and versioning guide: [RELEASING.md](./RELEASING.md)

## 📄 License

[MIT](./LICENSE)
