# API Reference

> Audience: developers and integrators.
>
> If you only want to use Tidetime in the browser, start with [Getting Started](./GETTING_STARTED.md) or the [User Guide](./USER_GUIDE.md).

Tidetime exposes a versioned REST API under `/api/v1`.

## Quick summary

You can use the API to:

- list and manage services
- look up availability
- create and manage bookings
- create booking links
- list customers
- manage outgoing webhooks

## Authentication

Create an API key in **Dashboard → Settings → API keys**.

Send it as a bearer token:

```bash
curl https://your-host.example/api/v1/event-types \
  -H "Authorization: Bearer tt_your_api_key"
```

A query-string `apiKey` fallback exists for compatibility, but bearer auth is recommended because it keeps credentials out of URLs and most logs.

## Pagination

List endpoints support:

- `limit` — default `50`, maximum `200`
- `offset`
- `page`

Example:

```bash
curl "https://your-host.example/api/v1/bookings?limit=25&page=2" \
  -H "Authorization: Bearer tt_your_api_key"
```

## Naming note

In the Tidetime dashboard, the product uses the word **services**.

In the API, the same resource is still named **`event-types`**.

## Endpoints

### Services (`event-types`)

#### `GET /api/v1/event-types`

List services owned by the authenticated user.

#### `POST /api/v1/event-types`

Create a personal service.

Example body:

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

#### `GET /api/v1/event-types/:id`

Fetch one service owned by the authenticated user.

#### `PATCH /api/v1/event-types/:id`

Update fields on an existing service.

#### `DELETE /api/v1/event-types/:id`

Delete a service.

### Availability

#### `GET /api/v1/availability?username=&slug=&from=&to=&duration=`

Public availability lookup for a personal service.

Notes:

- date ranges are validated and capped
- `duration` must be between 5 and 1440 minutes

### Bookings

#### `GET /api/v1/bookings`

List bookings for the authenticated user.

Optional query parameters include:

- `status`
- `from`
- `to`
- pagination parameters

#### `POST /api/v1/bookings`

Create a booking on a personal service owned by the authenticated user.

Example body:

```json
{
  "username": "demo",
  "slug": "intro-call",
  "start": "2026-06-02T14:00:00.000Z",
  "duration": 30,
  "timeZone": "Europe/London",
  "name": "Alex Doe",
  "email": "alex@example.com",
  "responses": {
    "notes": "Looking forward to it"
  }
}
```

Example response:

```json
{
  "data": {
    "uid": "bk_xxxxx"
  }
}
```

#### `GET /api/v1/bookings/:uid`

Fetch one booking owned by the authenticated user.

#### `PATCH /api/v1/bookings/:uid`

Approve or reject a pending booking.

Example body:

```json
{
  "status": "accepted"
}
```

#### `DELETE /api/v1/bookings/:uid`

Cancel a booking.

### Booking links

#### `POST /api/v1/booking-links`

Create a special booking link for one of your services.

Supported kinds:

- `one_time`
- `expiring`
- `limited`
- `invite`

### Customers

#### `GET /api/v1/customers`

List customers associated with the authenticated user's bookings.

### Webhooks

#### `GET /api/v1/webhooks`

List registered outgoing webhooks.

#### `POST /api/v1/webhooks`

Create a webhook subscription.

Example body:

```json
{
  "subscriberUrl": "https://example.com/tidetime-webhook",
  "triggers": ["booking_created", "booking_cancelled"]
}
```

If no secret is supplied, Tidetime generates one for you.

#### `GET /api/v1/webhooks/:id`

Fetch one webhook.

#### `PATCH /api/v1/webhooks/:id`

Update a webhook.

#### `DELETE /api/v1/webhooks/:id`

Delete a webhook.

## Other useful endpoints

These are not part of the versioned REST surface above, but they are useful operationally:

- `GET /api/health` — simple health check for uptime monitoring
- `GET /api/slots` — public slot lookup for personal services
- `GET /api/slots/team` — public slot lookup for team services

## Outgoing webhook signatures

Outgoing webhook deliveries include this header:

```text
X-Tidetime-Signature-256: sha256=<hex-hmac>
```

The signature is the HMAC-SHA256 of the raw JSON payload using the webhook's secret.

## Error format

API errors use a small JSON shape:

```json
{
  "error": "Human-readable message"
}
```

## Stability guidance

When building against the API:

- rely on `/api/v1` routes rather than internal unversioned endpoints
- treat undocumented fields as subject to change
- update your client when new releases change validation or behavior

## Related guides

- [Glossary](./GLOSSARY.md)
- [Deployment](./DEPLOYMENT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
