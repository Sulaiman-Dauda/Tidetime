# Architecture

> Audience: contributors and developers.
>
> If you only want to use Tidetime as a product, you can skip this file and start with [Getting Started](./GETTING_STARTED.md).

This document explains how Tidetime is organized and why the code is split the way it is.

## The main idea

Tidetime tries to keep three concerns separate:

1. **user interface**
2. **business rules**
3. **server and database work**

That split makes the codebase easier to test, easier to change, and easier to understand.

## Folder map

```text
src/
├── app/         Next.js routes, pages, layouts, server actions, API handlers
├── app-store/   Pluggable conferencing + CRM integrations (registry-based)
├── components/  Reusable UI components
├── db/          Database schema, migrations, and seed helpers
├── emails/      React Email templates (rendered to HTML server-side)
├── hooks/       Shared React hooks for client components
├── i18n/        Internationalization (ICU message catalogs + helpers)
├── lib/         Pure business logic and shared helpers
└── server/      Server-only coordination and integrations
```

## What lives where

### `src/app`

This is the application layer.

It contains:

- pages
- layouts
- API routes
- server actions
- route-specific UI

Think of this folder as the part that receives input from users and turns it into actions.

### `src/app-store`

A small registry of pluggable integrations, modeled loosely on Cal.com's app store. Each app is declared in `registry.ts` and grouped by category:

- **Conferencing / video:** Daily (`daily/`), Zoom (`zoom/`), Microsoft Teams (`msteams/`). Jitsi Meet is built in as a zero-config default location.
- **CRM:** HubSpot (`hubspot/`).

Shared plumbing lives alongside the apps: `conferencing.ts`, `crm.ts`, `credentials.ts` (encrypted per-user credential storage), and `types.ts`. New integrations are added by registering an `AppDefinition` rather than by threading provider-specific code through the booking flow.

### `src/components`

This folder holds reusable UI pieces.

Examples:

- form controls
- buttons
- cards
- shared widgets

### `src/db`

This is the database layer.

It contains:

- the Drizzle schema
- migration helpers
- seed utilities

### `src/emails`

[React Email](https://react.email) templates that are rendered to HTML on the server before sending. Rendering is **asynchronous** — always `await` the render helper.

### `src/hooks`

Shared React hooks used by client components.

### `src/i18n`

Internationalization: ICU-formatted message catalogs and the helpers that load and format them.

### `src/lib`

This is where Tidetime keeps logic that does not need direct database or framework access.

Examples:

- slot calculation
- booking field validation
- reminder planning
- permission rules
- payment math
- CSV export helpers

This is one of the most important folders because it keeps core rules testable in isolation.

### `src/server`

This folder combines the pure logic from `src/lib` with real infrastructure work.

Examples:

- database reads and writes
- email delivery
- webhook sending
- Google Calendar calls
- Stripe calls
- reminder processing

## Why `src/lib` and `src/server` are separate

A useful way to think about it:

- **`src/lib`** decides what should happen
- **`src/server`** performs the real-world work needed to make it happen

This keeps important business rules from being trapped inside database code or UI code.

Server-only modules import `"server-only"` at the top, so any accidental import into client bundles fails the build. This enforces the boundary mechanically rather than by convention — credentials, secrets, and direct database access can never leak into the browser.

## How a booking moves through the system

### Public booking flow

1. a visitor opens a public booking page
2. Tidetime loads the service and schedule information
3. the client requests available slots from the server
4. slot calculation runs on the server
5. the visitor submits the booking form
6. the server validates the request
7. Tidetime saves the booking and sends follow-up actions such as notifications

### Team scheduling flow

For team services:

1. Tidetime loads the relevant team members
2. each person's availability is calculated
3. results are combined based on the team scheduling mode
4. the final booking is assigned according to the chosen rules

### Reminder and webhook flow

1. when a booking is created, Tidetime creates reminder jobs and enqueues any matching webhook deliveries
2. the [job runner](#job-runner) processes due jobs
3. due reminders and review requests are sent; pending webhook deliveries are retried with backoff; expired data is cleaned up

## Job runner

All recurring background work funnels through a single function, `runDueJobs()` (`src/server/jobs.ts`). Each tick processes, in order:

1. **reminders** — due reminder/notification jobs
2. **review requests** — post-meeting review emails
3. **webhook deliveries** — pending rows in `webhook_deliveries` whose backoff window has elapsed (up to 5 attempts, exponential backoff capped at 6 hours)
4. **retention cleanup** — expired sessions, verification tokens, stale calendar cache, abandoned draft services, and old bookings

A tick is guarded by a **Postgres session-level advisory lock**, so two runners (or a worker plus an external scheduler firing at the same moment) never process the same jobs twice — a contended tick simply returns `{ skipped: true }`.

There are two ways to drive `runDueJobs()`, and they are safe to run together:

- **HTTP trigger** — `POST` or `GET` `/api/cron`, authenticated with a `CRON_SECRET` bearer token (or `?secret=`). The handler hashes both the provided and expected secret and compares them with a **constant-time** check. Wire this to Vercel Cron, Cloud Scheduler, GitHub Actions, etc.
- **Sidecar worker** — `scripts/worker.ts`, a long-running process that calls `runDueJobs()` on an interval. Use this for plain VM / container deployments without an external scheduler.

## Validation approach

Tidetime validates input at the edges of the system.

That means checks happen when data comes in through places such as:

- API routes
- server actions
- public query parameters
- environment variables

This helps protect the deeper booking logic from bad or incomplete input.

## Security boundaries

### Authentication and sessions

Tidetime uses:

- opaque session tokens
- hashed session storage in the database
- `HttpOnly` cookies
- `SameSite=Lax` cookies
- a stricter `__Host-` cookie in production

### Stored secrets and credentials

Tidetime protects sensitive values by:

- encrypting stored integration credentials (the app-store apps in `src/app-store`)
- hashing API keys with SHA-256 before storage (the plaintext is shown once)
- hashing session tokens before storage
- verifying inbound Stripe webhook signatures
- signing **outgoing** webhooks with HMAC-SHA256 (header `X-Tidetime-Signature-256`)
- running an SSRF guard before every outgoing webhook send

### Browser and HTTP protections

Tidetime also applies:

- global security headers
- a Content Security Policy
- stronger frame protection on sensitive routes

Public booking pages remain embeddable so the booking widget can work across sites.

## Database model at a glance

Main records include:

- `users`
- `sessions`
- `schedules`
- `availabilities`
- `event_types`
- `bookings`
- `attendees`
- `teams`
- `memberships`
- `api_keys`
- `webhooks`
- `webhook_deliveries`
- `payments`
- `workflows`
- `scheduled_reminders`

`webhook_deliveries` is the **durable retry queue** that sits alongside `webhooks`: every dispatched event is persisted there with its full JSON body, attempt count, status, and next-attempt time, so the job runner can retry failures without losing events.

The schema tries to stay explicit so relationships are easier to follow.

## Operational notes

A few implementation details matter when working on Tidetime:

- first-run setup uses a PostgreSQL advisory lock so only one owner account can win at the same time
- company-wide settings are stored in `app_settings`
- the app is designed for single-instance self-hosting rather than a large multi-node setup

## Why this structure works well

This layout helps because:

- UI changes stay mostly in the app and component layers
- business rules can be tested without booting the full app
- infrastructure code stays grouped in one place
- contributors can work in smaller, easier-to-understand areas

## Related guides

- [Contributing](../CONTRIBUTING.md)
- [API Reference](./API.md)
- [Embed lifecycle](./EMBED_LIFECYCLE.md)
- [Deployment](./DEPLOYMENT.md)
