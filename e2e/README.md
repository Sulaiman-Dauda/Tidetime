# End-to-end tests

Browser tests (Playwright) that drive the real app against a seeded database.
They complement — they don't replace — the fast vitest unit suite (`npm test`).

## Run locally

```bash
# 1. A Postgres the app can reach
docker compose up -d db

# 2. Schema + demo data (creates the `demo` user with an `intro` service)
npm run db:migrate
npm run db:seed

# 3. One-time: install the browser
npx playwright install chromium

# 4. Build, start, and drive the app (config does this automatically)
npm run test:e2e
```

## Options

- `E2E_BASE_URL` — point at an already-running instance and skip the built-in
  build/start (e.g. `E2E_BASE_URL=https://staging.example.com npm run test:e2e`).
- `E2E_USER` / `E2E_SLUG` — target a different seeded handle/service.

## What's covered

`booking.spec.ts` — the public booking happy path: open a service page → pick an
available day + time → enter details → confirm → land on the booking management
page. The flow is anchored on stable `data-testid`s (`day-available`, `slot`,
`confirm-booking`) plus the `#name` / `#email` inputs, so it survives styling
changes.

Add specs for reschedule and cancel alongside this one as the suite grows.
