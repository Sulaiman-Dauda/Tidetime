# Review guidelines

The standard a pull request is held to here. Written down so a review is the
same whoever runs it, and so a contributor can predict what will be asked
before they are asked it.

Tidetime holds customer bookings, contact details and calendar credentials for
the businesses that run it. That is the reason for the care below.

## Before reviewing

- **Read the linked issue.** A PR with no issue and no statement of the problem
  gets that question first, not a line-by-line review.
- **Check CI honestly.** Green is necessary, not sufficient. A red build is not
  "flaky" until someone has looked at why. Three dependency PRs sat open here
  with a real React version mismatch that would have broken the production
  build.
- **Run it if it touches booking.** The public booking flow is the product; it
  gets exercised, not reasoned about.

## What gets checked

### Correctness

- Does it do what the description says, and only that? A fix bundled with a
  refactor is two reviews pretending to be one.
- Timezones and DST. Almost every scheduling bug lives here. A change touching
  availability, slots or conflicts needs a test that crosses a DST boundary.
- Double-booking. Any change to slot generation or conflict checking must not
  open a race between two people booking the same slot.

### Data and privacy

- Bookings contain names, emails and phone numbers. New logging must not put
  them in a log line, an error message or an analytics event.
- Calendar tokens (Google, Microsoft) are credentials. They are never logged,
  never returned by an API response, and never committed.
- New queries are scoped to the tenant. A missing `where` is a data leak here,
  not a bug.

### Auth

- Sessions are opaque tokens in `httpOnly`/`secure` cookies, revocable as rows.
  A change that moves toward a JWT needs a very good argument.
- Passwords are hashed in application code with scrypt, never by the database.
- Anything touching sessions, roles or TOTP gets a second pass and a test.

### Tests

- A bug fix comes with a test that **fails without the fix**. If it passes
  before and after, it is not testing the fix.
- The booking e2e suite must pass. It exists because the booking flow breaking
  silently is the worst outcome for this product.

### Documentation

- Behaviour a user sees changes the docs in the same PR.
- New settings and env vars get documented where the others are, and
  `.env.example` updated.
- `CHANGELOG.md` gets an entry for anything a user would notice.

### Style

- Type-check and lint clean. No new `any` without a comment saying why.
- Comments explain **why**, not what.
- Match the surrounding code. Consistency beats personal preference.

## Merging

- **Squash only.** The PR title becomes the commit subject, so it is rewritten
  to be a good one.
- The commit body says what changed and why.
- Required checks pass, conversations resolved, branch up to date with `main`.

## Turning something down

Say so early and say why. A PR left open for weeks is worse than a clear no in
a day. If the idea is right but the implementation is not, say which.

Contributors are doing unpaid work. The tone is "here is what this needs",
never "this is wrong".
