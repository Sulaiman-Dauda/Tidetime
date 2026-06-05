<div align="center">

# 🌊 Tidetime

**Scheduling, perfected.**

Tidetime is an open-source scheduling platform for self-hosted booking, team coordination, and day-to-day appointment management.

[![CI](https://github.com/Sulaiman-Dauda/tidetime/actions/workflows/ci.yml/badge.svg)](https://github.com/Sulaiman-Dauda/tidetime/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/badge/release-v0.1.0-0f172a)](./docs/releases/v0.1.0.md)

[Documentation](./docs/README.md) ·
[Getting started](./docs/GETTING_STARTED.md) ·
[User guide](./docs/USER_GUIDE.md) ·
[Admin guide](./docs/ADMIN_GUIDE.md) ·
[Deployment](./docs/DEPLOYMENT.md)

</div>

---

Tidetime helps people and teams publish booking pages, manage availability, organize services, send reminders, and keep appointments running smoothly.

## Start with the guide that fits you

- **I just want to start using Tidetime** → [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- **I need help with everyday tasks** → [docs/USER_GUIDE.md](./docs/USER_GUIDE.md)
- **I manage the workspace** → [docs/ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md)
- **I have a question** → [docs/FAQ.md](./docs/FAQ.md)
- **I want simple definitions for Tidetime terms** → [docs/GLOSSARY.md](./docs/GLOSSARY.md)
- **I want to install Tidetime on my own server** → [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- **I want to build with the API** → [docs/API.md](./docs/API.md)
- **I want to work on the codebase** → [CONTRIBUTING.md](./CONTRIBUTING.md)

> If Tidetime is already installed for you, you can skip the self-hosting sections and start with the user guides above.

## What Tidetime does

Tidetime is built for booking-driven work such as consultations, appointments, classes, team schedules, shared resources, and paid sessions.

With Tidetime you can:

- create one or many bookable services
- share personal and team booking pages
- set weekly hours and date-specific overrides
- prevent conflicts with Google Calendar sync
- send confirmations, cancellations, and reminders
- accept paid bookings with Stripe
- organize customers, teams, categories, resources, and reviews
- create special booking links for invites, expiry dates, or limited use

## What is included today

### Ready to use now

- personal and team scheduling
- public booking pages and embeddable widget
- Google Calendar sync
- paid bookings with Stripe checkout
- API keys and developer API access
- outgoing webhooks
- email notifications and reminders
- the ability to pause public bookings
- customer management, reviews, resources, and teams

### Not shipped yet

- built-in Google Meet connection flow
- built-in Zoom connection flow
- Outlook calendar sync
- hosted file uploads in booking forms

## Main areas of the product

| Area | What it helps you do |
| --- | --- |
| **Services** | Create the bookable offerings people can choose, such as a consultation, class, or session |
| **Availability** | Set your regular working hours, special dates, and notice rules |
| **Booking pages** | Share personal or team booking pages that customers can use without contacting you manually |
| **Bookings** | View, confirm, cancel, reschedule, and track appointments |
| **Calendar** | See upcoming accepted and pending bookings in one place |
| **Customers** | Keep a clean list of people who have booked with you |
| **Payments** | Charge for paid services with Stripe |
| **Resources** | Prevent double-booking of rooms, equipment, or shared assets |
| **Reviews** | Collect private feedback and send happy customers to your public review page |
| **Teams** | Work together with shared services and team roles |
| **Automation** | Use booking links, API keys, webhooks, and health checks |

## Quick start for self-hosting

This quick start is for developers or technical admins who want to run Tidetime themselves.

### Requirements

- Node.js **20+**
- PostgreSQL **14+**
- npm **10+**

### 1. Clone the repository and install dependencies

```bash
git clone https://github.com/Sulaiman-Dauda/tidetime.git
cd tidetime
npm install
```

### 2. Copy the environment file

```bash
cp .env.example .env
openssl rand -base64 32
```

Paste the generated value into `AUTH_SECRET`.

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 4. Apply database migrations

```bash
npm run db:migrate
```

### 5. Seed demo data if you want a sample account

```bash
npm run db:seed
```

Demo account:

- email: `demo@tidetime.app`
- password: `password123`
- booking page: `/demo`

> Do not use seed data in production.

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On a brand-new instance, Tidetime opens the setup flow so you can create the owner account and then your first service.

## Configuration at a glance

Copy `.env.example` to `.env` and set the values you need.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | Tells Tidetime whether it is running locally or in production |
| `APP_URL` | yes in production | `http://localhost:3000` | The public web address people use to reach your Tidetime app |
| `APP_NAME` | no | `Tidetime` | The product name shown in the app |
| `DATABASE_URL` | yes in production | local Postgres URL | Connection string for PostgreSQL |
| `AUTH_SECRET` | yes in production | none | Secret used to secure stored credentials and sessions |
| `GOOGLE_CLIENT_ID` | optional | unset | Needed only if you want Google Calendar sync |
| `GOOGLE_CLIENT_SECRET` | optional | unset | Needed only if you want Google Calendar sync |

A few important notes:

- SMTP settings are saved in the **Settings → Email** section inside the app
- Stripe settings are saved in **Settings → Stripe** inside the app
- Google Calendar still needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the server environment before users can connect their calendars

For full setup help, read:

- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the local development server |
| `npm run build` | Builds the app for production |
| `npm run start` | Runs the production build |
| `npm run lint` | Checks the code style |
| `npm run typecheck` | Runs TypeScript checks |
| `npm test` | Runs the automated test suite |
| `npm run check` | Runs lint, typecheck, tests, and a production build |
| `npm run db:migrate` | Applies database migrations |
| `npm run db:seed` | Loads demo data |
| `npm run jobs:reminders` | Processes reminder jobs once |

## Documentation map

- [docs/README.md](./docs/README.md) — documentation hub
- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) — first steps for new users
- [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) — day-to-day use
- [docs/ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) — workspace setup and admin tools
- [docs/FAQ.md](./docs/FAQ.md) — common questions
- [docs/GLOSSARY.md](./docs/GLOSSARY.md) — plain-English definitions
- [docs/API.md](./docs/API.md) — developer API reference
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — codebase structure for contributors
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — production hosting guide
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) — common problems and fixes

## API

Tidetime exposes a versioned REST API under `/api/v1`.

Create an API key in **Settings → API keys**, then send it as a bearer token:

```bash
curl http://localhost:3000/api/v1/event-types \
  -H "Authorization: Bearer tt_your_api_key"
```

See [docs/API.md](./docs/API.md) for endpoint details, examples, pagination, and webhook signing.

## Deployment

For production use, you can either:

- run the provided Docker Compose stack with PostgreSQL and the app
- deploy the app manually with Node.js and PostgreSQL

Start here:

- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

## Security

Tidetime includes security-focused defaults such as:

- secure sign-in sessions
- encrypted stored credentials
- signed outgoing webhooks
- Stripe webhook verification
- production startup checks for unsafe or missing settings

For reporting guidance, see [SECURITY.md](./SECURITY.md).

## Testing

```bash
npm run check
```

The automated test suite covers core scheduling logic, validations, payments, reminders, permissions, reviews, resources, and other business rules.

## Contributing

Contributions are welcome.

Please read:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)

## Releases

- first public release: [docs/releases/v0.1.0.md](./docs/releases/v0.1.0.md)
- release process: [RELEASING.md](./RELEASING.md)
- change history: [CHANGELOG.md](./CHANGELOG.md)

## License

[MIT](./LICENSE)
