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

2. Copy the environment file and generate a local auth secret:

   ```bash
   cp .env.example .env
   openssl rand -base64 32
   ```

3. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

4. Apply migrations and optionally seed demo data:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

## Local quality checks

Run the same checks expected in CI before opening a pull request:

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

- **Issues** — usually looked at within a few days. A bug with clear steps to
  reproduce gets attention fastest.
- **Pull requests** — a first response within about a week. Large changes take
  longer, which is why it is worth opening an issue before building one.
- **Security reports** — prioritised over everything else. Report privately via
  [Security → Report a vulnerability](../../security/advisories/new).

If something has gone quiet for longer, a comment on the thread is welcome.

There is **no CLA and no DCO sign-off**. The bar a PR is held to is written down
in [`.github/REVIEW_GUIDELINES.md`](./.github/REVIEW_GUIDELINES.md) — worth two
minutes before you start, so nothing in review is a surprise.

## Security issues

Do **not** open public issues for vulnerabilities. Follow the disclosure process in [SECURITY.md](./SECURITY.md).

## Questions and feature ideas

Use the repository issue templates for bugs and feature requests when the project is hosted on GitHub.
