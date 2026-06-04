# Troubleshooting

This document covers common local and deployment issues.

## Runtime error: failed query / missing column on `event_types`

If you see an error like:

- `Failed query: select ... from "event_types" ...`
- `column "round_robin_mode" does not exist`
- `column "deposit_amount" does not exist`
- `column "requires_payment" does not exist`

then your database schema is behind the application code.

### Fix

Run the latest migrations:

```bash
npm run db:migrate
```

Then restart the app.

### Why it happens

The codebase and database schema must stay in sync. If you pull a newer version of the repository without applying its migrations, Drizzle will generate queries for columns your database does not have yet.

## Typecheck errors referencing `.next/types`

If TypeScript complains about missing `.next/types/...` files, run:

```bash
npm run typecheck
```

Tidetime's typecheck script runs `next typegen` first, which regenerates route types before TypeScript executes.

## Emails are not being delivered

- Go to **Settings → Email** and verify your SMTP credentials are correct
- Click **Test connection** to validate your SMTP server is reachable
- Check spam/junk folders
- If no SMTP is configured, emails are logged to the console instead

## Stripe key tests are failing

- Go to **Settings → Stripe** and verify your Stripe keys are correct
- Click **Test secret key** to validate your secret key works
- Ensure the webhook endpoint is configured in your Stripe dashboard

Tidetime expects the publishable key, secret key, and webhook secret to be saved together. Paid bookings only go live when the Stripe webhook can reach `/api/stripe/webhook` and the service itself has **Require payment** enabled.

## Why can’t I connect Google Calendar or find Google Meet / Zoom in the dashboard?

- Google Calendar is available today, but it requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the app environment before the connect flow can work.
- Google Meet and Zoom provider-native connection flows are not shipped yet. Use a custom link, phone, or in-person location for now.

## Booking page says “Booking temporarily unavailable”

- Check **Settings → Booking defaults**
- Make sure **Disable public bookings** is turned off
- If it is enabled intentionally, the public landing pages, slot APIs, and booking form will all stay unavailable until you turn it back on

## Docker app starts but booking/payment features fail

Check:

- `.env` was mounted or copied correctly
- `APP_URL` matches the public origin
- PostgreSQL is reachable from the container network
- migrations have been applied

## Need a quick health check?

Use:

```text
GET /api/health
```

- `200` means the app can reach PostgreSQL
- `503` means the app is running but database access failed
