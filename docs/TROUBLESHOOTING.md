# Troubleshooting

> Audience: admins, self-hosters, and contributors.
>
> If you are a regular user, you may still find this helpful, but you should also check the [FAQ](./FAQ.md) and [Getting Started](./GETTING_STARTED.md).

This guide covers common problems and the fastest fixes.

## Quick checks first

Before digging deeper, confirm these basics:

- the app is using the right `APP_URL`
- PostgreSQL is reachable
- `AUTH_SECRET` is set in production
- the latest database migrations have been applied
- email, Google Calendar, or Stripe settings are configured if you rely on them

## Problem: the app shows database query errors or missing columns

Examples:

- `column "round_robin_mode" does not exist`
- `column "deposit_amount" does not exist`
- `column "requires_payment" does not exist`
- a failed query on `event_types`

### What it usually means

The application code is newer than the database schema.

### Fix

Run the latest migrations:

```bash
npm run db:migrate
```

Then restart the app.

### Why this happens

Tidetime's code and database schema need to stay in sync.

## Problem: booking page says “Booking temporarily unavailable”

### What it usually means

Public bookings are disabled for the workspace.

### Fix

Go to **Settings → Booking** and check **Disable public bookings**.

If it is turned on, public pages, slot lookups, and booking forms will stay unavailable until you turn it off.

## Problem: emails are not being delivered

### Check these first

- verify SMTP settings in **Settings → Email**
- use **Test connection** inside the app
- confirm the sender address is valid
- check spam or junk folders

### Important note

If SMTP is not configured, Tidetime logs emails to the server console instead of sending them.

## Problem: Stripe payment tests are failing

### Check these first

- the publishable key is correct
- the secret key is correct
- the webhook secret is correct
- the Stripe webhook endpoint is configured

Tidetime expects the publishable key, secret key, and webhook secret to be stored together.

Paid bookings only work when:

- Stripe can reach `/api/stripe/webhook`
- the service itself is set to require payment

## Problem: Google Calendar will not connect

### Check these first

- `GOOGLE_CLIENT_ID` is set in the server environment
- `GOOGLE_CLIENT_SECRET` is set in the server environment
- the app has been restarted after adding them
- you are connecting from **Settings → Calendar**

If those environment variables are missing, the Google Calendar flow cannot work.

## Problem: I cannot find Google Meet or Zoom setup

Tidetime does not currently include built-in provider connection flows for Google Meet or Zoom.

For now, use another location type such as:

- custom link
- phone call
- in-person location

## Problem: Docker starts, but booking or payment features do not work

### Check these first

- the correct `.env` file is mounted or copied into the container
- `APP_URL` matches the public address users actually visit
- PostgreSQL is reachable from the container network
- migrations have been applied

A large share of production issues come from environment values not matching the real deployment.

## Problem: `/api/health` returns `503`

### What it usually means

The app is running, but it cannot complete its database check.

### Fix

Check:

- PostgreSQL is running
- `DATABASE_URL` is correct
- the database accepts connections from the app
- network or container settings are not blocking access

## Problem: TypeScript complains about `.next/types`

This mostly affects contributors and local development.

### Fix

Run:

```bash
npm run typecheck
```

Tidetime's typecheck script regenerates route types before TypeScript runs.

## Problem: I changed the code, but behavior still looks old

Try these steps:

1. restart the app
2. rebuild if needed with `npm run build`
3. confirm the latest code is actually deployed
4. confirm the latest migrations were applied

## Quick health check

Use:

```text
GET /api/health
```

Meaning:

- `200` = app and database are talking normally
- `503` = app is up, but database access failed

## Still stuck?

Use the guide that best matches your problem:

- [Admin Guide](./ADMIN_GUIDE.md)
- [Deployment](./DEPLOYMENT.md)
- [API Reference](./API.md)
- [FAQ](./FAQ.md)
