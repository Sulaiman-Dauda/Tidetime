# API Reference

> Audience: developers and integrators.
>
> If you only want to use Tidetime in the browser, start with [Getting Started](./GETTING_STARTED.md) or the [User Guide](./USER_GUIDE.md).

Tidetime exposes a versioned REST API under `/api/v1`. This page is the authoritative endpoint reference. Schemas here are taken directly from the route handlers under `src/app/api/v1/**`.

## Quick summary

You can use the API to:

- list and manage services
- look up public availability
- create and manage bookings
- create booking links
- list customers and reviews
- manage outgoing webhooks

## Authentication

API keys are created in **Dashboard → Settings → API keys**.

- Creating a key is **admin-only**.
- A key grants **full account access** — there are no per-key scopes. Treat a key like a password.
- Keys are stored only as a **SHA-256 hash**. The plaintext (prefixed `tt_`) is shown **once** at creation and never again.
- Dashboard-created keys **do not expire**; they remain valid until revoked. (The auth layer honours an `expiresAt` if one is ever set, but the dashboard never sets one.)

Send the key as a bearer token (recommended, case-insensitive `Bearer ` prefix):

```bash
curl https://your-host.example/api/v1/event-types \
  -H "Authorization: Bearer tt_your_api_key"
```

A query-string `apiKey` fallback exists for compatibility:

```bash
curl "https://your-host.example/api/v1/event-types?apiKey=tt_your_api_key"
```

Bearer auth is recommended because it keeps credentials out of URLs and most logs.

An unauthenticated request to a protected endpoint returns:

```json
HTTP/1.1 401 Unauthorized
{ "error": "Unauthorized" }
```

## Rate limits

Rate limits are enforced **per key owner** (per account, not per key).

| Endpoint | Limit |
| --- | --- |
| Default (most endpoints) | **120 requests / minute** |
| `POST /api/v1/bookings` | **30 requests / minute** |
| `POST /api/v1/webhooks` | **120 requests / minute** |
| `GET` endpoints | not rate-limited |
| `[id]` / `[uid]` mutation routes (PATCH, DELETE) | not rate-limited |

When a limit is exceeded the response is:

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 42
{ "error": "Too many requests" }
```

`Retry-After` is in seconds.

## Pagination

List endpoints accept either `offset` or `page` (1-based), plus `limit`:

- `limit` — default `50`, maximum `200`
- `offset` — zero-based row offset
- `page` — 1-based page number (used only when `offset` is absent)

List responses always wrap rows and echo the resolved window:

```json
{
  "data": [ /* rows */ ],
  "page": { "limit": 50, "offset": 0 }
}
```

Example:

```bash
curl "https://your-host.example/api/v1/bookings?limit=25&page=2" \
  -H "Authorization: Bearer tt_your_api_key"
```

## Error format

Errors use a small JSON shape:

```json
{ "error": "Human-readable message" }
```

Validation failures return `400` with the first failing field's message. Other status codes are noted per endpoint below.

## Naming note

In the dashboard the product calls this resource a **service**. In the API the same resource is still named **`event-types`**. The two terms are interchangeable.

## Endpoint reference

`key` = requires an API key. `public` = no auth.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/event-types` | key | list services |
| POST | `/api/v1/event-types` | key | create service; duplicate slug → `409` |
| GET | `/api/v1/event-types/:id` | key | one service / `404` |
| PATCH | `/api/v1/event-types/:id` | key | update / `404` |
| DELETE | `/api/v1/event-types/:id` | key | delete |
| GET | `/api/v1/availability` | **public** | public slot lookup |
| GET | `/api/v1/bookings` | key | list bookings |
| POST | `/api/v1/bookings` | key, 30/min | create booking; failure → `422` |
| GET | `/api/v1/bookings/:uid` | key | one booking / `404` |
| PATCH | `/api/v1/bookings/:uid` | key | accept/reject / `422` |
| DELETE | `/api/v1/bookings/:uid` | key | cancel / `422` |
| POST | `/api/v1/booking-links` | key | create a booking link |
| GET | `/api/v1/customers` | key | list/search customers |
| GET | `/api/v1/reviews` | key | list reviews + stats |
| GET | `/api/v1/webhooks` | key | list webhooks |
| POST | `/api/v1/webhooks` | key, 120/min | create webhook |
| GET | `/api/v1/webhooks/:id` | key | one webhook / `404` |
| PATCH | `/api/v1/webhooks/:id` | key | update / `404` |
| DELETE | `/api/v1/webhooks/:id` | key | delete |

---

### Services (`event-types`)

#### `GET /api/v1/event-types`

List the authenticated user's services, ordered by display position.

```json
{
  "data": [ { "id": 1, "title": "Intro call", "slug": "intro-call", "...": "..." } ],
  "page": { "limit": 50, "offset": 0 }
}
```

#### `POST /api/v1/event-types`

Create a personal service.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `title` | string | yes | 1–128 chars |
| `slug` | string | yes | 1–128 chars, must match `^[a-z0-9-]+$` |
| `description` | string | no | |
| `length` | integer | no | minutes, 1–1440 |
| `hidden` | boolean | no | |
| `requiresConfirmation` | boolean | no | |
| `minimumBookingNotice` | integer | no | minutes, ≥ 0 |
| `price` | integer | no | minor units, ≥ 0 |
| `currency` | string | no | exactly 3 chars |

```json
{
  "title": "Intro call",
  "slug": "intro-call",
  "length": 30,
  "requiresConfirmation": false,
  "minimumBookingNotice": 120,
  "currency": "usd",
  "price": 0
}
```

Returns `201` with `{ "data": { /* created service */ } }`. A slug already used by the same account returns `409`:

```json
{ "error": "A service with that slug already exists" }
```

#### `GET /api/v1/event-types/:id`

Fetch one service owned by the authenticated user, or `404`.

#### `PATCH /api/v1/event-types/:id`

Update fields on an existing service. Any subset of the create fields (except `slug`) plus two buffer fields:

| Field | Type | Constraints |
| --- | --- | --- |
| `title` | string | 1–128 chars |
| `description` | string \| null | |
| `length` | integer | 1–1440 |
| `hidden` | boolean | |
| `requiresConfirmation` | boolean | |
| `minimumBookingNotice` | integer | ≥ 0 |
| `beforeEventBuffer` | integer | minutes, ≥ 0 |
| `afterEventBuffer` | integer | minutes, ≥ 0 |
| `price` | integer | ≥ 0 |
| `currency` | string | 3 chars |

Returns `{ "data": { /* updated service */ } }`, or `404` if not owned.

#### `DELETE /api/v1/event-types/:id`

Delete a service.

```json
{ "data": { "id": 12, "deleted": true } }
```

Returns `404` if the service is not owned by the caller.

---

### Availability

#### `GET /api/v1/availability`

**Public — no API key required.** Returns bookable slots for a personal service. Responses are sent with `Cache-Control: no-store`.

| Query param | Required | Constraints |
| --- | --- | --- |
| `username` | yes | account handle |
| `slug` | yes | service slug |
| `from` | no | ISO datetime; defaults to now |
| `to` | no | ISO datetime; defaults to `from + 33 days`. Range from `from` may not exceed **93 days** |
| `duration` | no | minutes, 5–1440; defaults to the service length |

```bash
curl "https://your-host.example/api/v1/availability?username=demo&slug=intro-call&duration=30"
```

```json
{ "data": { "slots": [ /* … */ ] } }
```

Errors: `400` (missing/invalid params or range too wide), `404` (service not found).

---

### Bookings

#### `GET /api/v1/bookings`

List the authenticated user's bookings, newest first. Each row includes its `attendees`.

| Query param | Notes |
| --- | --- |
| `status` | one of `pending`, `accepted`, `cancelled`, `rejected` (others ignored) |
| `from` | ISO datetime; filters `startTime >= from` |
| `to` | ISO datetime; filters `startTime <= to` |
| `limit` / `offset` / `page` | pagination |

```json
{
  "data": [
    {
      "uid": "bk_xxxxx",
      "status": "accepted",
      "startTime": "2026-06-02T14:00:00.000Z",
      "attendees": [ { "name": "Alex Doe", "email": "alex@example.com" } ]
    }
  ],
  "page": { "limit": 50, "offset": 0 }
}
```

Invalid `from`/`to` returns `400`.

#### `POST /api/v1/bookings`

Create a booking on a service owned by the authenticated user. **Rate-limited to 30/min.**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `username` | string | yes | service owner handle |
| `slug` | string | yes | service slug |
| `start` | string | yes | ISO datetime |
| `timeZone` | string | yes | IANA time zone |
| `name` | string | yes | attendee name |
| `email` | string | yes | attendee email |
| `duration` | integer | no | minutes |
| `responses` | object | no | answers to custom booking fields |
| `guests` | array | no | additional guests |

```json
{
  "username": "demo",
  "slug": "intro-call",
  "start": "2026-06-02T14:00:00.000Z",
  "duration": 30,
  "timeZone": "Europe/London",
  "name": "Alex Doe",
  "email": "alex@example.com",
  "responses": { "notes": "Looking forward to it" }
}
```

Returns `201`:

```json
{ "data": { "uid": "bk_xxxxx" } }
```

A service the caller doesn't own returns `404`. A booking that cannot be created (slot taken, validation, etc.) returns `422` with an explanatory `error`.

#### `GET /api/v1/bookings/:uid`

Fetch one booking (with `attendees`) owned by the authenticated user, or `404`.

#### `PATCH /api/v1/bookings/:uid`

Confirm or reject a pending booking. `status` must be **`accepted` or `rejected`** — nothing else is accepted.

```json
{ "status": "accepted" }
```

```json
{ "data": { "uid": "bk_xxxxx", "status": "accepted" } }
```

A state transition that can't be applied returns `422`.

#### `DELETE /api/v1/bookings/:uid`

Cancel a booking. Optional `?reason=` is recorded and may be surfaced to the attendee.

```bash
curl -X DELETE \
  "https://your-host.example/api/v1/bookings/bk_xxxxx?reason=double-booked" \
  -H "Authorization: Bearer tt_your_api_key"
```

```json
{ "data": { "uid": "bk_xxxxx", "status": "cancelled" } }
```

Returns `404` if not owned, `422` if it cannot be cancelled.

---

### Booking links

#### `POST /api/v1/booking-links`

Create a shareable booking link for one of your services.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `eventTypeId` | integer | yes | a service you own |
| `kind` | string | yes | one of `one_time`, `expiring`, `limited`, `invite` |
| `maxUses` | integer | no | for `limited` links |
| `expiresAt` | string | no | ISO datetime, for `expiring` links |
| `inviteEmail` | string | no | for `invite` links |

```json
{ "eventTypeId": 12, "kind": "expiring", "expiresAt": "2026-07-01T00:00:00.000Z" }
```

Returns `201`. The public consumption path for a link token is `/i/{token}`:

```json
{ "data": { "token": "abc123…", "url": "https://your-host.example/i/abc123…" } }
```

A service the caller doesn't own returns `404`.

---

### Customers

#### `GET /api/v1/customers`

List/search the authenticated user's customers, ordered by most recent booking.

| Query param | Notes |
| --- | --- |
| `q` | case-insensitive substring match on name or email |
| `limit` / `offset` / `page` | pagination |

```json
{
  "data": [ { "name": "Alex Doe", "email": "alex@example.com", "lastBookingAt": "…" } ],
  "page": { "limit": 50, "offset": 0 }
}
```

---

### Reviews

#### `GET /api/v1/reviews`

List the authenticated user's reviews together with summary statistics. This response is **not** paginated and does **not** use the `page` wrapper:

```json
{
  "data": [ /* reviews */ ],
  "stats": { /* aggregate rating summary */ }
}
```

---

### Webhooks

See [Outgoing webhooks](#outgoing-webhooks) for payloads, signatures, and delivery semantics.

#### `GET /api/v1/webhooks`

List the user's webhook subscriptions (paginated).

#### `POST /api/v1/webhooks`

Register a webhook. **Rate-limited to 120/min.**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `subscriberUrl` | string | yes | publicly routable HTTPS URL (SSRF-validated) |
| `triggers` | string[] | yes | at least one trigger name (see below) |
| `secret` | string | no | 8–256 chars; **auto-generated if omitted** |
| `eventTypeId` | integer | no | scope deliveries to one service |
| `active` | boolean | no | defaults to `true` |

```json
{
  "subscriberUrl": "https://example.com/tidetime-webhook",
  "triggers": ["booking_created", "booking_cancelled"]
}
```

Returns `201` with the created webhook (including its `secret`).

#### `GET /api/v1/webhooks/:id`

Fetch one webhook, or `404`.

#### `PATCH /api/v1/webhooks/:id`

Update `subscriberUrl`, `triggers`, `secret`, and/or `active`. Returns the updated webhook, or `404` if not owned.

#### `DELETE /api/v1/webhooks/:id`

Delete a webhook.

```json
{ "data": { "id": 7, "deleted": true } }
```

---

## Outgoing webhooks

### Triggers

The schema defines **seven** trigger names. **Only five are dispatched today.**

| Trigger | Dispatched? | Fires when |
| --- | --- | --- |
| `booking_created` | yes | a confirmed booking is created |
| `booking_requested` | yes | a booking needing confirmation is requested |
| `booking_rescheduled` | yes | a booking is moved to a new time |
| `booking_cancelled` | yes | a booking is cancelled |
| `booking_rejected` | yes | a pending request is rejected |
| `meeting_started` | **no** | accepted on subscription but never fired today |
| `meeting_ended` | **no** | accepted on subscription but never fired today |

You may subscribe to `meeting_started` / `meeting_ended`, but no deliveries will ever be produced for them in the current build.

### Payload envelope

Every delivery has the same envelope:

```json
{
  "triggerEvent": "booking_created",
  "createdAt": "2026-06-02T13:55:00.000Z",
  "payload": { /* trigger-specific */ }
}
```

For booking events the `payload` includes:

```json
{
  "uid": "bk_xxxxx",
  "eventTypeId": 12,
  "title": "Intro call",
  "startTime": "2026-06-02T14:00:00.000Z",
  "endTime": "2026-06-02T14:30:00.000Z",
  "attendee": { "name": "Alex Doe", "email": "alex@example.com", "timeZone": "Europe/London" },
  "status": "accepted"
}
```

(`booking_cancelled` also carries `reason`; `booking_rejected` carries the `uid`. Exact fields vary slightly per trigger.)

### Signatures

When a webhook has a secret, each delivery includes:

```text
X-Tidetime-Signature-256: sha256=<hex-hmac>
```

The value is the HMAC-SHA256 of the **raw JSON request body** keyed by the webhook's `secret`. Compute the same HMAC over the bytes you receive and compare in constant time. If a webhook has **no secret**, no signature header is sent.

### Delivery and retries

- Success = any HTTP **2xx** response.
- Up to **5 attempts** per delivery.
- Backoff is exponential: base **60s**, doubling each attempt, capped at **6 hours**.
- Each request has a **10s timeout**.
- Redirects are **not followed** (`redirect: "manual"`) — a 3xx is treated as a failed attempt.
- Before every send, an **SSRF guard** re-resolves the URL and rejects non-public targets (so a rebound DNS record can't redirect delivery at an internal host).
- The first attempt is made **best-effort at dispatch time**; remaining attempts are drained by the job runner (see [Architecture → Job runner](./ARCHITECTURE.md#job-runner)).
- Deliveries are persisted in a durable `webhook_deliveries` queue table, so a subscriber outage never drops events.

---

## Other useful endpoints

These are not part of the versioned `/api/v1` surface but are useful operationally:

- `GET /api/health` — simple health check for uptime monitoring
- `GET /api/slots` — public slot lookup for personal services
- `GET /api/slots/team` — public slot lookup for team services

## Stability guidance

When building against the API:

- rely on `/api/v1` routes rather than internal unversioned endpoints
- treat undocumented response fields as subject to change
- update your client when new releases change validation or behavior

## Related guides

- [Architecture](./ARCHITECTURE.md)
- [Embed lifecycle](./EMBED_LIFECYCLE.md)
- [Glossary](./GLOSSARY.md)
- [Deployment](./DEPLOYMENT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
</content>
</invoke>
