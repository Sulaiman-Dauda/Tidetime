# Architecture

This document explains how Tidetime is structured and where key responsibilities live.

## High-level layout

```text
src/
├── app/         # Next.js routes, pages, layouts, server actions, API handlers
├── components/  # UI primitives and shared components
├── db/          # Drizzle schema, migration runner, seed script
├── lib/         # Pure business logic and shared helpers
└── server/      # Server-only orchestration and integration modules
```

## Design principles

### 1. Keep business logic testable

Logic that can be expressed without framework or database dependencies belongs in `src/lib`.

Examples:

- slot calculation
- reminder planning
- RBAC rules
- booking field validation
- CSV export
- payment math

This keeps the most error-prone logic unit-testable and reusable.

### 2. Keep orchestration server-side

Modules in `src/server` coordinate:

- database access
- email delivery
- webhook dispatch
- Stripe interaction
- booking persistence
- reminder processing

These modules compose the pure logic from `src/lib` with infrastructure concerns.

### 3. Validate at the edges

External input enters through:

- API routes
- server actions
- public query parameters
- environment variables

Each boundary validates and normalizes data before it reaches the deeper booking logic.

## Request flows

### Public booking flow

1. A visitor opens a public booking page
2. The page resolves an event type and its schedule
3. The client fetches slots from `/api/slots` or `/api/slots/team`
4. Slot generation runs on the server using the pure slot engine
5. The visitor submits a booking through a server action or API route
6. The booking service validates inputs, checks availability, persists records, and sends notifications

### Team scheduling flow

For team event types:

1. hosts are loaded from `eventTypeHosts`
2. each host's availability is computed separately
3. results are merged based on the scheduling mode
4. booking creation assigns a host using round-robin or collective rules

### Reminder flow

1. reminder workflows are translated into concrete reminder jobs when a booking is created
2. the reminder worker (`npm run jobs:reminders`) processes due jobs in batches
3. each reminder is marked handled to avoid duplicate sends

## Security boundaries

### Auth

- sessions use opaque random tokens
- only token hashes are stored in the database
- cookies are `HttpOnly` and `SameSite=Lax`
- production uses a `__Host-` session cookie for stronger browser-enforced scoping

### Credentials and secrets

- credential payloads are encrypted at rest
- API keys are stored only as SHA-256 hashes
- Stripe webhook payloads are signature-verified
- outgoing webhooks are HMAC-signed

### HTTP surface

- global security headers are applied through `next.config.ts`
- a Content-Security-Policy is sent on every response
- sensitive routes receive stricter framing protection
- public booking pages remain frameable so the embed widget works cross-origin

## Database model overview

Core entities include:

- `users`
- `sessions`
- `schedules` and `availabilities`
- `event_types`
- `bookings` and `attendees`
- `teams` and `memberships`
- `api_keys`
- `webhooks`
- `payments`
- `workflows` and `scheduled_reminders`

The schema intentionally keeps relations explicit and avoids magical side effects.

## Operational safety notes

- first-run setup is serialized with a PostgreSQL advisory lock so only one owner account can win
- company-wide settings are stored in `app_settings` and merged over explicit defaults
- the app is designed for single-instance self-hosting rather than multi-node orchestration

## Why this structure works well for open source

- contributors can work in isolated layers
- logic-heavy changes can be tested without booting the app
- infrastructure code stays localized
- the codebase remains understandable without a large framework abstraction layer
