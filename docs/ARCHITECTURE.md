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
├── components/  Reusable UI components
├── db/          Database schema, migrations, and seed helpers
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

### Reminder flow

1. when a booking is created, Tidetime creates reminder jobs
2. the reminder worker checks for due jobs
3. due reminders are sent and marked as handled

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

- encrypting stored credentials
- hashing API keys before storage
- verifying Stripe webhook signatures
- signing outgoing webhooks

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
- `payments`
- `workflows`
- `scheduled_reminders`

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
- [Deployment](./DEPLOYMENT.md)
