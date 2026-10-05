# Contributing to Tidetime

> Audience: contributors and code collaborators.
>
> If you are looking for product help instead, start with the [README](./README.md).

Thanks for contributing to Tidetime. 🌊

This guide explains how to work on the project, run the local checks, and open high-quality pull requests.

## Code of Conduct

By participating in this project, you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Before you start

Please:

- search existing issues and pull requests first
- keep each pull request focused on one concern
- prefer small, reviewable changes over large mixed refactors
- update docs when behavior, APIs, or configuration change

Useful links:

- Issues: https://github.com/Sulaiman-Dauda/Tidetime/issues
- New bug report: https://github.com/Sulaiman-Dauda/Tidetime/issues/new?template=bug_report.yml
- New feature request: https://github.com/Sulaiman-Dauda/Tidetime/issues/new?template=feature_request.yml
- Pull requests: https://github.com/Sulaiman-Dauda/Tidetime/pulls

## Development setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file and edit it for local development:

   ```bash
   cp .env.example .env
   ```

   The example file is set up for production. In `.env`, delete the `NODE_ENV=production` line, set `APP_URL=http://localhost:3100`, and set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/tidetime` (the database started in the next step). The secrets can stay empty in development. To run the jobs worker locally, also set `CRON_SECRET` (generate one with `openssl rand -base64 32`) and `JOBS_TARGET_URL=http://localhost:3100/api/cron`, then run `node --env-file=.env scripts/jobs-worker.mjs`.

3. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

4. Apply migrations and optionally seed demo data:

   ```bash
   npm run db:migrate
   npm run db:seed   # optional; skip it to create your own company at /setup
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

## Local quality checks

Run these checks before opening a pull request. CI runs the same steps, and also the booking end-to-end suite (`npm run test:e2e`), which is a required check:

```bash
npm run check
```

That command runs:

- ESLint
- TypeScript type-checking
- Vitest
- a production build

## Branches and commits

We recommend [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add public health endpoint`
- `fix: reject invalid public slot durations`
- `docs: document jobs worker deployment`
- `refactor: centralize service validation`

Typical branch prefixes:

- `feat/...`
- `fix/...`
- `docs/...`
- `chore/...`
- `refactor/...`
- `test/...`

## Pull request checklist

Before opening a PR, make sure:

- [ ] the change is scoped and understandable
- [ ] `npm run check` passes locally
- [ ] new logic has tests when appropriate
- [ ] docs were updated when behavior changed
- [ ] no secrets, `.env` files, or credentials were committed
- [ ] database changes include generated migrations and updated Drizzle metadata

## Coding guidelines

### General

- Keep TypeScript strict.
- Prefer existing utilities over adding new dependencies.
- Keep code easy to remove, replace, and reason about.
- Avoid dead code, placeholder logic, and misleading UI copy.

### Project structure

- `src/lib` should stay as framework-agnostic as possible.
- `src/server` is for server-only modules and integrations.
- `src/app` contains route handlers, pages, layouts, and server actions.
- `src/db` contains schema and migration utilities.

### Interface

- Build screens from the primitives in `src/components/ui` (Button, Field, FormSection,
  Card, Table, Badge, Segmented, Dialog and the rest) and `PageHeader` / `EmptyState`.
  If one is missing something, extend it rather than styling a one-off.
- Colours come from the tokens in `src/app/globals.css`: surfaces (`canvas`, `background`,
  `card`, `popover`), `primary` and `accent`, and the status colours `success`, `warning`,
  `info` and `destructive`, each with a `-subtle` fill. No Tailwind palette classes
  (`text-emerald-600`) and no hex values in components.
- Public pages take their accent from the company brand colour (`src/lib/brand-theme.ts`),
  so they must only use `primary`, `accent` and `ring` for accent colour.
- Text is never smaller than `text-xs` (12px). Make layouts compact with spacing, not
  smaller type.
- Fonts must be under a licence that allows redistribution (the app ships Geist, SIL OFL 1.1).
- Check every screen you touch in light and dark mode and at a phone width.

### Validation and security

- Validate all external input at the boundary.
- Never trust query params, JSON bodies, or form payloads without parsing.
- Do not log secrets or raw credentials.
- Prefer explicit allow-lists over permissive parsing.

## Database changes

When changing the schema:

1. Update `src/db/schema.ts`
2. Generate a migration:

   ```bash
   npm run db:generate
   ```

3. Commit all generated SQL and `drizzle/meta/*` updates
4. Do not rewrite old migrations that may already have been applied by users

## Documentation expectations

Please update documentation for:

- new environment variables
- deployment changes
- API changes
- user-visible behavior
- contributor workflow changes

Relevant docs live in [`docs/`](./docs).

## What to expect from us

Tidetime is maintained by one person alongside other work. Being honest about
that is better than leaving you guessing:

- **Issues**: usually looked at within a few days. A bug with clear steps to
  reproduce gets attention fastest.
- **Pull requests**: a first response within about a week. Large changes take
  longer, which is why it is worth opening an issue before building one.
- **Security reports**: prioritised over everything else. Report privately via
  [Security → Report a vulnerability](../../security/advisories/new).

If something has gone quiet for longer, a comment on the thread is welcome.

There is **no CLA and no DCO sign-off**. The bar a PR is held to is written down
in [`.github/REVIEW_GUIDELINES.md`](./.github/REVIEW_GUIDELINES.md). Reading it takes
two minutes and means nothing in review is a surprise.

## Security issues

Do **not** open public issues for vulnerabilities. Follow the disclosure process in [SECURITY.md](./SECURITY.md).

## Questions and feature ideas

Use the repository issue templates for bugs and feature requests when the project is hosted on GitHub.
