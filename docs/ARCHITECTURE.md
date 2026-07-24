# Architecture

This document describes how Tidetime is put together, for contributors and operators who want to understand the moving parts.

## Overview

Tidetime is a single [Next.js](https://nextjs.org) application (App Router) written in TypeScript. It serves both the public booking pages and the authenticated dashboard, and it talks to a PostgreSQL database through [Drizzle ORM](https://orm.drizzle.team). In production it runs as a standalone Node server behind [Caddy](https://caddyserver.com), alongside PostgreSQL and a small background worker.

```
Browser ──► Caddy (HTTPS) ──► Next.js app ──► PostgreSQL
                                  │
                                  ├─► SMTP or Microsoft 365 (email)
                                  ├─► Google / Microsoft Graph (calendars)
                                  └─► outgoing webhooks
Jobs worker ──► POST /api/cron ──► webhook retries + retention
```

## Code layout

- `src/app` holds the routes: pages, layouts, API route handlers, and server actions. Public pages live under `(public)`, the authenticated area under `dashboard`, and auth flows under `(auth)`.
- `src/server` holds server-only modules: booking logic, calendars, email, webhooks, settings, and background jobs.
- `src/lib` holds framework-agnostic helpers: cryptography, rate limiting, time and formatting, validation schemas, and spam checks.
- `src/db` holds the Drizzle schema and migration utilities.
- `src/components` holds the UI, built on Radix primitives and Tailwind CSS.
- `src/emails` holds the email templates.

## Requests and data flow

Most write operations are Next.js server actions rather than REST endpoints. API route handlers under `src/app/api` exist for the things that need them: OAuth callbacks, the health check, the ALTCHA challenge, CSV export, the domain-verification gate for Caddy, and the cron trigger. All external input is validated at the boundary with [Zod](https://zod.dev) before it reaches the database.

Bookings are created inside a database transaction. Provider assignment, group-seat checks, and daily caps are resolved there so the same slot cannot be double-booked under concurrent requests.

## Authentication and authorization

Authentication is a custom, cookie-based session. Passwords are hashed with scrypt, session tokens are random and stored only as hashes, and optional TOTP two-factor authentication gates login. Authorization is checked in the server queries and mutations, scoped by role and ownership, so restrictions are enforced server-side and not only hidden in the interface.

Integration credentials (OAuth tokens, SMTP passwords) are encrypted at rest. Purpose-specific keys are derived from a single `AUTH_SECRET` so no two uses share raw key material.

## Background jobs

Two jobs run on a schedule: retrying failed webhook deliveries and purging data past the retention window. They are triggered by an authenticated `POST /api/cron`. In production a small worker container calls that endpoint on an interval. A transaction-scoped advisory lock ensures only one run proceeds at a time, even if the worker and an external scheduler overlap.

## Calendars and email

Calendar and email integrations are optional and configured per instance. Google Calendar is read for conflicts and written to a chosen destination calendar. Microsoft 365 is read-only for conflict checks. Email goes through SMTP or Microsoft 365, whichever the administrator selects. Outgoing webhooks are signed with an HMAC and validated against server-side rules that block private network targets.

## Deployment shape

The production Docker Compose stack runs four services: PostgreSQL, the standalone Next.js server, the jobs worker, and Caddy. The app applies database migrations on startup. Caddy terminates TLS and obtains certificates for custom domains on demand, gated by an app endpoint so it only issues certificates for the configured domain. The application port stays bound to localhost so all remote traffic passes through Caddy. See the [deployment guide](./DEPLOYMENT.md) for the operational details.

## Testing

The project uses Vitest for unit tests and Playwright for end-to-end booking tests. `npm run check` runs linting, type-checking, unit tests, and a production build, and is the same set of checks expected in continuous integration.
