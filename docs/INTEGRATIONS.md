# Integrations Guide

This guide is the full catalog of services you can connect to Tidetime: calendars, video, CRM, payments, and email.

It is written for the admin who sets connections up and for the self-hoster who supplies credentials. For the broader admin walkthrough, see the [Admin Guide](./ADMIN_GUIDE.md). For server setup, see [Deployment](./DEPLOYMENT.md).

## How integrations are configured

Open **Dashboard → Integrations**. The hub has tabs for **Calendars**, **Video**, **CRM**, **Payments**, **Email**, and (for admins) **Setup**. A **Licensed** or **Community** edition badge appears in the corner.

There are two kinds of configuration, and it helps to keep them separate:

- **Instance-wide credentials** (admin, once). OAuth client IDs/secrets and the Daily API key are set up one time for the whole Tidetime instance. Calendar credentials are managed in their own cards; the others live under **Integrations → Setup**.
- **Per-user connections** (each staff member). After credentials exist, each staff member connects their own account in one click under **Integrations → Calendars**, **Video**, or **CRM**.

### DB-first, with env fallback

Provider credentials resolve **database-first, with an environment-variable fallback**:

1. If an admin has pasted credentials in the UI, those are used. They are stored **encrypted at rest** (AES-GCM) so secrets never sit in the database or backups in plaintext.
2. Otherwise Tidetime falls back to the matching environment variables.

This means you can choose either path:

- **In-app (recommended):** paste credentials under Integrations → Setup. No redeploy needed.
- **Environment variables:** set the env vars listed below. This requires a redeploy/restart to pick up.

Saved secrets are shown masked (for example `gle3••••9z`). For OAuth cards, leaving the Client ID or Client Secret blank on re-save **keeps the existing value**.

### Redirect URIs

`{APP_URL}` below is the value of your `APP_URL` environment variable (your public base URL, with no trailing slash). When you register an OAuth app with a provider, add the exact redirect URI shown. The Setup tab also displays each redirect URI with a copy button.

## Quick reference

| Integration | What it does | Where to enable | Env vars |
|---|---|---|---|
| Google Calendar | Two-way calendar sync + native Google Meet links | Setup (OAuth), then per-user under Calendars | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Microsoft 365 / Outlook | Two-way calendar sync via Microsoft Graph; backs Teams links | Setup (OAuth), then per-user under Calendars | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Apple / CalDAV | Connect any CalDAV server | Per-user under Calendars; no admin/env setup | none |
| Zoom | Per-booking Zoom link | Setup (OAuth), then per-user under Video | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` |
| Daily | Auto-created video room per booking | Setup (API key) | `DAILY_API_KEY`, `DAILY_SUBDOMAIN` |
| Microsoft Teams | Teams link on the Outlook event | Requires the user's Microsoft 365 connection | (uses Microsoft creds) |
| HubSpot | Logs each booking as a contact + meeting | Setup (OAuth) + CRM feature flag on, then per-user under CRM | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` |
| Built-in Jitsi | Free built-in video, zero config | Choose it as a service location | none |
| Stripe | Collect deposits / full payment | Payments tab | (entered in-app) |
| SMTP / Email | Confirmations, reminders, cancellations | Email tab | (entered in-app) |

---

## Calendars

### Google Calendar

**What it does.** Two-way sync — Tidetime reads your busy times so you are never double-booked, and writes each booking onto your calendar. When you connect, Google is the one provider that lets you pick **which calendars to check for conflicts** and **which calendar receives new bookings**. If a booking uses a Google Meet location, the meeting link is minted natively on the event.

**How to enable.**

1. **Admin, once:** register an OAuth client in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and paste the Client ID and Secret under **Integrations → Setup → Google** (or set the env vars below and redeploy).
2. **Each staff member:** connect their own Google account under **Integrations → Calendars**.

**Env vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**Redirect URI:** `{APP_URL}/api/google-calendar/callback`

**Gotchas.**

- Scopes requested: `calendar.readonly` (read busy times) and `calendar.events` (create/update booking events).
- The OAuth `state` is signed and expires after 15 minutes — finish the connect flow promptly.

### Microsoft 365 / Outlook

**What it does.** Two-way calendar sync via Microsoft Graph (read busy times, create and update events). This is also the connection that backs **Microsoft Teams** meeting links.

**How to enable.**

1. **Admin, once:** register an app in the [Azure Portal](https://portal.azure.com) and paste the Client ID and Secret under **Integrations → Setup → Microsoft 365** (or set the env vars and redeploy).
2. **Each staff member:** connect their own Microsoft account under **Integrations → Calendars**.

**Env vars:** `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

**Redirect URI:** `{APP_URL}/api/microsoft-calendar/callback`

**Gotchas.**

- Uses the `common` tenant, so both work and personal Microsoft accounts can connect.
- Scopes include `offline_access` (for refresh tokens) and `Calendars.ReadWrite` (busy times plus event CRUD), along with `openid`, `email`, and `User.Read`.
- The per-calendar picker offered for Google is **not** available here.

### Apple / CalDAV

**What it does.** Connects any CalDAV server — iCloud, Fastmail, Nextcloud, and similar — for two-way sync.

**How to enable.** No admin or environment setup is required; this option is **always available**. Each staff member enters a **server URL**, **username**, and **app password** under **Integrations → Calendars**.

**Env vars:** none

**Redirect URI:** none (this is not an OAuth flow)

**Gotchas.**

- For iCloud, use `https://caldav.icloud.com` as the server URL and an **app-specific password** (not your main Apple password).
- The server URL is SSRF-checked: private, loopback, and link-local addresses are rejected before Tidetime connects.
- There is no per-calendar conflict/destination picker (that UI is Google-only).

---

## Video

Video apps attach a meeting link to every booking automatically. The link source depends on the location you choose on the service.

### Zoom

**What it does.** Creates a Zoom meeting per booking and puts the join link on the event.

**How to enable.**

1. **Admin, once:** create an OAuth app in the [Zoom Marketplace](https://marketplace.zoom.us) and paste the Client ID and Secret under **Integrations → Setup → Zoom** (or set the env vars and redeploy).
2. **Each staff member:** install Zoom for their own account under **Integrations → Video**.

**Env vars:** `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`

**Redirect URI:** `{APP_URL}/api/apps/zoom_video/callback`

**Gotchas.**

- Uses the Authorization Code grant. Refresh tokens are stored encrypted and refreshed automatically; if a refresh fails the credential is marked invalid and the user reconnects.

### Daily

**What it does.** Auto-creates a Daily video room for each booking.

**How to enable.** This is **account-level**, not per-user OAuth. An admin adds a **Daily API key** (and an optional subdomain) on the **Daily** card under **Integrations → Setup** (or sets the env vars and redeploys). Once configured, Daily is available to **everyone** on the instance.

**Env vars:** `DAILY_API_KEY`, `DAILY_SUBDOMAIN` (subdomain optional)

**Redirect URI:** none (API-key auth, not OAuth)

**Gotchas.**

- Because it is account-level, there is nothing for individual staff to install — once the key is set, the location option appears for all users.
- Rooms are set to expire roughly two hours after the meeting ends, so unused rooms are not left open.

### Microsoft Teams

**What it does.** Adds a Microsoft Teams meeting link to the Outlook calendar event.

**How to enable.** There is **no separate setup**. Teams links are minted natively when Tidetime creates the Outlook event, so Teams simply requires the user's **Microsoft 365 calendar connection** (see above). In the Integrations UI, "installed" for Teams means the user has a Microsoft calendar credential.

**Env vars:** uses the Microsoft credentials.

**Redirect URI:** n/a (no standalone video API)

**Gotchas.**

- There is no standalone Teams video API to configure. If a user has not connected Microsoft 365, Teams is not available to them.

### Built-in Jitsi

**What it does.** Free, built-in video conferencing with zero configuration.

**How to enable.** Jitsi is **always available**. It is not a card in the Integrations UI — instead, choose **Jitsi Meet (built-in)** as the location when setting up a service.

**Env vars:** none

**Redirect URI:** none

**Gotchas.**

- Because there is nothing to connect, it is a good default when you want video without setting up Zoom, Daily, or Teams.

---

## CRM

### HubSpot

**What it does.** On each new booking, Tidetime upserts the attendee as a HubSpot **contact** and logs a **meeting** engagement on that contact's timeline.

**How to enable.**

1. **Admin:** turn on the **CRM sync** business feature (Settings page → Business features). This is what surfaces CRM apps under **Integrations → CRM**.
2. **Admin, once:** create an app in [HubSpot Developers](https://developers.hubspot.com) and paste the Client ID and Secret under **Integrations → Setup → HubSpot** (or set the env vars and redeploy).
3. **Each staff member:** connect their own HubSpot account under **Integrations → CRM**.

**Env vars:** `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`

**Redirect URI:** `{APP_URL}/api/apps/hubspot/callback`

**Gotchas.**

- Scopes requested: `crm.objects.contacts.read` and `crm.objects.contacts.write`.
- The CRM tab is hidden entirely until the CRM feature flag is on.
- Logging is **best-effort** — if HubSpot is unreachable or returns an error, the booking still succeeds. CRM sync never blocks a booking.

---

## Payments

### Stripe

**What it does.** Collects payment at booking time — either a deposit or the full amount — for services that require payment.

**How to enable.** Open **Integrations → Payments** and enter your Stripe **publishable key**, **secret key**, and **webhook secret**. All three are entered in-app and stored encrypted. Then point a Stripe webhook at Tidetime.

**Redirect URI:** n/a. Configure your Stripe webhook endpoint to send events to:

```
{APP_URL}/api/stripe/webhook
```

**Gotchas.**

- Secret fields show a masked `•••` placeholder when already set; leaving a field on the placeholder **preserves the existing secret** on re-save.
- Paid bookings only work once: the keys and webhook secret are saved, Stripe is actually sending events to the webhook endpoint, and the **service itself is set to require payment**.
- Deposits are supported, so you can charge part of the price up front.
- Match your Stripe account currency to the **default currency** set in Settings → Brand.

---

## Email

### SMTP

**What it does.** Sends transactional email — booking confirmations, reminders, and cancellations — over your own SMTP server.

**How to enable.** Open **Integrations → Email** and enter the SMTP **host**, **port**, **username**, **password**, and **from** address. Use the **Test connection** button before going live.

**Redirect URI:** n/a

**Gotchas.**

- If email is **not** configured, Tidetime logs messages to the server console instead of sending them — useful in development, but it means customers receive nothing until SMTP is set up.
- TLS is auto-enabled when the port is **465** (implicit TLS). Other ports use the standard upgrade path.

---

## Troubleshooting connections

- **The connect button is missing or greyed out.** The provider's instance-wide credentials are not configured. An admin needs to add them under Integrations → Setup (or set the env vars and redeploy).
- **CRM tab is missing.** The CRM business feature is off — turn it on from the Settings page.
- **OAuth fails with a redirect error.** The redirect URI registered with the provider does not exactly match `{APP_URL}/...`. Re-copy it from the Setup tab, and confirm `APP_URL` is your real public URL.
- **Google connect expires.** The signed state lasts 15 minutes; start the flow again.
- **Emails are not arriving.** Confirm SMTP is configured (otherwise messages only go to the console) and use Test connection.

For more, see [Troubleshooting](./TROUBLESHOOTING.md) and [Deployment](./DEPLOYMENT.md).
