# API Reference

Tidetime exposes a REST API under `/api/v1`.

## Authentication

Create an API key in **Dashboard → Settings → API keys** and pass it as a bearer token:

```bash
curl https://your-host.example/api/v1/event-types \
  -H "Authorization: Bearer tt_your_api_key"
```

A query-string `apiKey` fallback exists for compatibility, but bearer auth is recommended because it avoids leaking credentials in logs and URLs.

## Pagination

List endpoints support:

- `limit` (default `50`, max `200`)
- `offset`
- `page`

Example:

```bash
curl "https://your-host.example/api/v1/bookings?limit=25&page=2" \
  -H "Authorization: Bearer tt_your_api_key"
```

## Endpoints

### Event types

#### `GET /api/v1/event-types`

List event types owned by the authenticated user.

#### `POST /api/v1/event-types`

Create a personal event type.

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

Fetch a single event type owned by the authenticated user.

#### `PATCH /api/v1/event-types/:id`

Update fields on an existing event type.

#### `DELETE /api/v1/event-types/:id`

Delete an event type.

### Availability

#### `GET /api/v1/availability?username=&slug=&from=&to=&duration=`

Public availability lookup for a personal event type.

Notes:

- date ranges are validated and capped
- duration must be between 5 and 1440 minutes

### Bookings

#### `GET /api/v1/bookings`

List bookings for the authenticated user.

Optional query params:

- `status`
- `from`
- `to`
- pagination params

#### `POST /api/v1/bookings`

Create a booking on a personal event type owned by the authenticated user.

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

Response:

```json
{
  "data": {
    "uid": "bk_xxxxx"
  }
}
```

#### `GET /api/v1/bookings/:uid`

Fetch a single booking owned by the authenticated user.

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

Create a temporary booking link for one of your event types.

Kinds:

- `one_time`
- `expiring`
- `limited`
- `invite`

### Customers

#### `GET /api/v1/customers`

List customers associated with the authenticated user's bookings.

### Webhooks

#### `GET /api/v1/webhooks`

List registered webhooks.

#### `POST /api/v1/webhooks`

Create a webhook subscription.

Example body:

```json
{
  "subscriberUrl": "https://example.com/tidetime-webhook",
  "triggers": ["booking_created", "booking_cancelled"]
}
```

If no secret is supplied, Tidetime generates one.

#### `GET /api/v1/webhooks/:id`

Fetch a webhook.

#### `PATCH /api/v1/webhooks/:id`

Update a webhook.

#### `DELETE /api/v1/webhooks/:id`

Delete a webhook.

## Outgoing webhook signatures

Outgoing webhook deliveries include:

```text
X-Tidetime-Signature-256: sha256=<hex-hmac>
```

The signature is the HMAC-SHA256 of the raw JSON payload using the webhook's secret.

## Error format

API errors use a simple JSON shape:

```json
{
  "error": "Human-readable message"
}
```

## Stability guidance

- rely on `/api/v1` paths rather than unversioned internal endpoints
- treat undocumented fields as subject to change
- update clients when new releases change behavior or validation rules
