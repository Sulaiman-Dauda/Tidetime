# Integrations

Tidetime connects to a small, deliberate set of services. Credentials are stored encrypted in your own database and are configured either in the dashboard or through environment variables. Nothing is shared with a third party beyond the provider you connect.

## Google Calendar and Google Meet

Connecting Google Calendar lets a provider avoid double-bookings and generate Google Meet links.

What it does:

- Reads busy times from the provider's selected calendars, so Tidetime does not offer a slot that clashes with an existing event.
- Writes each new booking to a chosen destination calendar, and updates or removes it when the booking changes.
- Generates a Google Meet link for services that use Google Meet as their location.

Setup:

1. In Google Cloud, create OAuth credentials and set the callback to `<APP_URL>/api/google-calendar/callback`.
2. Put the client ID and secret in your environment as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. Each provider connects their own Google account from the dashboard.

## Microsoft 365 calendar

Connecting Microsoft 365 lets a provider check for conflicts against their Outlook calendar. This connection is read-only: Tidetime reads busy times but does not write events to Microsoft 365.

Setup uses a Microsoft Entra app registration with delegated Microsoft Graph permission. The same registration also covers Microsoft 365 email. Step-by-step instructions are in the [deployment guide](./DEPLOYMENT.md).

## Meeting links

Tidetime can attach a meeting link to a booking without any manual step:

- **Jitsi** is built in. A unique room is created per booking with no account required.
- **Google Meet** links are created when the provider has Google Calendar connected and the service uses Google Meet.

Other location types are available too: in person, a phone call the provider makes, a phone number the attendee provides, or a plain link you supply.

## Email

Outgoing email can go through either a standard SMTP server or a Microsoft 365 mailbox. Both are configured in the dashboard under **Connections**, and you choose which one is active. See the [admin guide](./ADMIN_GUIDE.md).

## Webhooks

Tidetime sends a signed webhook when a booking is created, rescheduled, or cancelled. This works with a Zapier Catch Hook or any endpoint you control.

Add a target URL under **Connections** and pick the events to send. Each delivery includes:

- `Content-Type: application/json`
- `X-Tidetime-Signature-256: sha256=<HMAC>` when a signing secret is set
- a JSON body of `{ triggerEvent, createdAt, payload }`

Delivery is guarded for safety and reliability: targets must be publicly routable HTTP or HTTPS URLs, redirects are not followed, requests time out after ten seconds, and failed deliveries retry with exponential backoff. Verify the signature on your side using the shared secret before trusting a payload.

## What Tidetime does not integrate with

To keep the app focused and honest, some things common to larger scheduling products are not included: payment processors, video providers other than Jitsi and Google Meet, Apple or CalDAV calendars, and a public API for third-party apps. If you need one of these, it is a good topic for a discussion or issue on GitHub.
