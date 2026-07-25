# Tidetime — agent brief

Self-hosted appointment scheduling for a single company with multiple services and providers.
Open source, self-hosted only — no hosted plan, no per-seat pricing, no third-party analytics.
Next.js + Drizzle ORM + PostgreSQL + Tailwind. npm, **Node >= 20**. Package version `0.1.2`.

> **This folder is the canonical Tidetime checkout.** Remote is
> `github.com/Sulaiman-Dauda/Tidetime`. Two stale clones (`Saas Porfolio/tidetime` and
> `~/Videos/tidetime`) were deleted on 2026-07-25 — if either reappears, it's a duplicate.

## Status: LAUNCHED — public, open source, as of 2026-07-25

This shipped this morning. It's public on GitHub and people can read every commit. That means:
honest commit messages, no half-finished features on `main`, no committed secrets, and a
`CHANGELOG.md` entry for anything user-facing.

The marketing site and docs live in a **separate** repo, `tidetime-website` — docs are synced
from this repo's `/docs` folder, so docs changes start here.

## Run it

```sh
docker compose up -d      # PostgreSQL (volume: tidetime_pgdata)
npm install
npm run db:migrate
npm run db:seed           # optional demo data
npm run dev
npm run jobs:worker       # background jobs, separate process
```

Useful: `npm run db:studio` (Drizzle Studio), `npm run db:generate` after schema edits.
`docker-compose.prod.yml` and `docker-compose.updater.yml` are deployment concerns, not local ones.

## Verifying a change

```sh
npm run check          # lint + typecheck + test + build — the floor, run before handing back
npm test               # vitest only, fast loop while working
npm run test:coverage
npm run test:e2e       # builds, starts the app, drives real Chromium against seeded demo data
```

`npm run check` passing means the change **compiles and doesn't regress**. It does not mean the
change works. For anything on the list below, exercise the real thing and say in the handback
what you actually observed — not "the code looks right".

| Touching | What "verified" means |
|---|---|
| Booking flow, availability, public pages | Place a real booking in the browser, then query the DB for the row. `npm run test:e2e` covers the seeded path; a new path needs a spec or a manual run. |
| Reminders, webhooks, anything queued | `npm run jobs:worker` must be running in a second process. Without it bookings look fine and nothing fires. Confirm the job actually ran. |
| Email | Render and read the real email. A template that compiles is not a template that looks right. |
| Zapier payloads | Payload shape is a public contract — a change is breaking. Capture the actual JSON sent. |
| Auth, sessions, TOTP | Load the page in a real browser with a real cookie. `curl` doesn't carry the session. |
| Services / event types | Check the public slug too: drafts must 404, published must resolve. |
| Schema | `npm run db:generate`, apply with `db:migrate`, then confirm against a **freshly migrated** DB — not one that happens to already have the column. |

If a surface couldn't be verified, say so plainly in the handback and name what's unproven.
Unverified is a normal outcome; unverified reported as done is not.

## Hard rules

1. **Migrations run against local only.** `db:migrate`, `db:push` and especially `db:reset` are
   destructive. Never point them at a deployed instance. `db:reset` drops data — confirm before
   running it even locally.
2. **Schema changes go through `db:generate` into `drizzle/`.** Never hand-edit a generated
   migration that has been committed; add a new one.
3. **Stage and show the diff; get an explicit go before committing or pushing.** Doubly so now
   the repo is public.
4. Never commit `.env` (9 keys in `.env.example`) or anything derived from a real customer's data.

## Gotchas

- Two Node processes are needed for full behaviour — the app and `jobs:worker`. Bookings appear
  to work without the worker until something needs a reminder or a webhook.
- Zapier webhooks are part of the product surface; changing payload shape is a breaking change.
- `db:migrate:runtime` is distinct from `db:migrate` — check which one a deployment path wants.
