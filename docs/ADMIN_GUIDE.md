# Admin Guide

This guide is for the person who manages a Tidetime workspace.

That may be the owner, a company admin, or a team lead with the right permissions.

If you only want to use Tidetime for your own day-to-day booking work, read the [User Guide](./USER_GUIDE.md) instead.

For the full catalog of calendar, video, CRM, payment, and email connections, see the [Integrations Guide](./INTEGRATIONS.md).

## What an admin usually manages

Admins are usually responsible for:

- brand and company details
- public booking behavior
- spam protection
- reviews and feedback routing
- legal notices and data retention settings
- API keys
- team structure and roles
- categories
- integrations (calendar, video, CRM, payments, email)
- company-wide closures

## Where things live

Tidetime splits configuration across two hubs. Knowing which is which saves a lot of hunting.

- **Dashboard → Settings** is the company-wide settings hub. It has exactly five tabs: **Brand**, **Booking**, **Reviews**, **API keys**, and **Legal**. A **Business features** card sits below those tabs on the same page.
- **Dashboard → Integrations** is where you connect outside services. It has tabs for **Calendars**, **Video**, **CRM**, **Payments**, **Email**, and (for admins) **Setup**.

A common point of confusion: **email, calendar, and Stripe live under Integrations, not Settings.** If you are looking for SMTP, Google Calendar, or payment keys, open **Dashboard → Integrations**.

## A simple go-live order

If you are setting up Tidetime for the first time, this is a good order:

1. create the owner account
2. update company branding and default currency
3. create the first services
4. set availability
5. configure email (Integrations → Email)
6. connect a calendar if needed (Integrations → Calendars)
7. configure Stripe if you charge for bookings (Integrations → Payments)
8. review legal settings
9. test the full booking flow
10. share the booking page

## Settings overview

Open **Dashboard → Settings**.

You will see five tabs — Brand, Booking, Reviews, API keys, and Legal — plus a Business features card underneath.

## Brand

Use **Settings → Brand** to control how Tidetime looks to customers.

You can set:

- company name
- company email (used as the sender and reply-to address for system emails)
- company website link
- company logo (upload an image under 1 MB or paste a URL)
- **default currency** — used for new paid services and price display; match this to your Stripe account currency
- **brand colour** — a hex value (for example `#4f46e5`) applied across the app so it uses your branding

These details appear across the booking experience and customer emails.

### Best practice

Keep the company name, email, logo, and website consistent with your public brand so customers know they are booking with the right business.

## Booking

Use **Settings → Booking** to control public booking behavior.

You can manage:

- **Disable public bookings** — temporarily stop all public bookings and show a maintenance message
- **Spam protection (ALTCHA)** — a privacy-friendly proof-of-work check on the booking form. It uses no third-party services and no tracking; it just makes automated spam bookings expensive
- **Future booking limit (days)** — how far ahead people can book
- **Minimum booking notice (minutes)** — how soon before a slot someone is allowed to book
- **Reschedule/cancel timeout (minutes)** — how close to the appointment changes are blocked
- **Appointment status labels** — the comma-separated status words used inside the system

### When to use "Disable public bookings"

Turn this on when you want to pause all new bookings without deleting services.

Useful examples:

- company holiday
- maintenance window
- temporary closure
- internal changes before relaunch

## Reviews

Use **Settings → Reviews** to control follow-up feedback requests.

These review settings are **per-user** — they apply to your own signed-in account, not the whole company.

You can:

- turn review requests on or off
- set the public review URL (where happy attendees are redirected, e.g. your Google review link)
- choose the **minimum rating for public redirect** — the dropdown offers only **4+ stars** or **5+ stars**

Tidetime's review flow is designed to:

- send happy attendees to your public review page
- keep lower ratings private so you can follow up internally

## API keys

Use **Settings → API keys** if you want another system to connect to Tidetime.

Examples:

- internal tools
- automation platforms
- custom websites
- scripts or integrations

See the [API Reference](./API.md) for endpoint details.

### Best practice

Treat API keys like passwords:

- keep them private
- store them securely
- remove old keys you no longer need
- create separate keys for separate tools when possible

## Legal

Use **Settings → Legal** to manage public legal text and links.

You can configure:

- cookie notice (toggle and text)
- terms and conditions (toggle and text)
- privacy policy (toggle and text)
- legal notice URL
- imprint URL
- **data retention (days)** — see "Data retention and cleanup" below

This helps you present the information customers may need when booking.

## Business features (feature flags)

Below the Settings tabs is a **Business features** card. These are heavier features that are off by default to keep the core product lean.

Currently this card exposes:

- **CRM sync** — push each booking to a connected CRM (such as HubSpot). Turning it on reveals the CRM apps under **Integrations → CRM**.

Enable only what you need; flipping a flag immediately reveals its navigation and integrations.

## Integrations

Open **Dashboard → Integrations** to connect outside services. The hub shows a **Licensed** or **Community** edition badge in the top corner.

The tabs are:

- **Calendars** — connect Google Calendar, Microsoft 365 / Outlook, and Apple / CalDAV. Each staff member connects their own account.
- **Video** — attach a meeting link to every booking (Zoom, Daily, Microsoft Teams).
- **CRM** — log each booking to your CRM (HubSpot). Only visible when the CRM business feature is on.
- **Payments** — connect Stripe to collect deposits or full payment at booking time.
- **Email** — configure your own SMTP server for confirmations, reminders, and cancellations.
- **Setup** — admins only. Paste provider OAuth credentials (Google, Microsoft, Zoom, HubSpot) and the Daily API key once for the whole instance.

For a full per-integration walkthrough — what each one does, how to enable it, redirect URIs, and gotchas — see the [Integrations Guide](./INTEGRATIONS.md).

### Calendar selection (Google)

When you connect Google Calendar, you can choose:

- which Google calendars Tidetime should check for conflicts
- which calendar should receive new bookings

This calendar-picking UI is **specific to Google**. Microsoft 365 and Apple / CalDAV connect separately and do not offer the same per-calendar selection.

### Email fallback

If email is not configured, Tidetime falls back to logging emails to the console instead of sending them. Use the **Test connection** button in Integrations → Email before going live.

### Before paid bookings will work

Make sure all of these are true:

- Stripe keys are saved correctly under Integrations → Payments
- the webhook secret is saved
- Stripe is sending events to Tidetime's webhook endpoint
- the service itself is set to require payment

If you do not charge for bookings, you can skip Stripe entirely.

## Blocked Periods

Open **Dashboard → Blocked Periods** for company-wide closures.

Blocked periods override normal schedules for the selected date and time range.

Use them for:

- holidays
- maintenance
- staff-wide training
- office closures
- events when nobody should be available

This is different from personal availability because it affects the wider workspace.

## Categories

Open **Dashboard → Categories** to group services.

Categories make the public booking page easier to browse when you offer several services.

Good category examples:

- Consultations
- Classes
- Team sessions
- Paid services
- New customers

## Teams and roles

Open **Dashboard → Teams** to create and manage team spaces.

Tidetime uses role-based access control. Each member of a team holds one role, and that role determines what they can do.

### Role permissions

| Permission | Owner | Admin | Manager | Provider | Receptionist | Member |
|---|---|---|---|---|---|---|
| View team (`team.view`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage team — rename, branding, capacity (`team.manage`) | ✓ | ✓ | | | | |
| Delete team (`team.delete`) | ✓ | | | | | |
| Invite members (`member.invite`) | ✓ | ✓ | ✓ | | | |
| Remove members (`member.remove`) | ✓ | ✓ | ✓ | | | |
| Assign roles (`member.role.assign`) | ✓ | ✓ | | | | |
| Manage services (`eventType.manage`) | ✓ | ✓ | ✓ | ✓ | | |
| Manage availability (`availability.manage`) | ✓ | ✓ | ✓ | ✓ | | |
| View bookings (`booking.view`) | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Manage bookings (`booking.manage`) | ✓ | ✓ | ✓ | | ✓ | |
| View analytics (`analytics.view`) | ✓ | ✓ | ✓ | | | |
| Manage billing (`billing.manage`) | ✓ | | | | | |

A quick summary of each role:

- **Owner** — all permissions.
- **Admin** — everything except deleting the team and managing billing.
- **Manager** — people and scheduling operations: invite/remove members, manage services and availability, view and manage bookings, view analytics.
- **Provider** — manages their own services and availability and can **view** their bookings, but cannot manage (reschedule/cancel) bookings.
- **Receptionist** — front desk: view and manage bookings only, no configuration changes.
- **Member** — read-only team visibility.

### Who can assign which role

Assigning a role requires the `member.role.assign` permission (Owners and Admins have it).

- An **Owner** can grant any role, including Admin.
- Everyone else can only grant roles strictly **below their own rank**.

Ranks are: Owner (5), Admin (4), Manager (3), Provider (2), Receptionist (2), Member (1).

So an Admin can grant Manager, Provider, Receptionist, or Member, but cannot grant another Admin or Owner.

## Service setup tips for admins

Even if team members create their own services, admins should still check that:

- service names are clear
- public pages are branded properly
- availability rules are realistic
- booking questions are not overly long
- paid services have the right payment settings
- hidden services are only hidden on purpose

If a service needs to hold more than one attendee per slot, set **Seats per slot** on that service.

## Data retention and cleanup

Tidetime runs a single retention and cleanup job on its job runner (the same runner that sends reminders and webhooks). It has two parts.

### Always-on hygiene

This runs regardless of your settings and keeps the database tidy. It deletes:

- expired sessions
- expired verification tokens
- expired calendar busy-time cache entries
- abandoned service drafts older than 24 hours
- resolved (delivered or failed) webhook deliveries older than 30 days

### Opt-in personal-data retention

Set **Settings → Legal → Data retention (days)** to turn this on.

- `0` disables it (nothing extra is deleted).
- When set to a positive number, bookings whose **end time** is older than the cutoff are **permanently deleted**, cascading to their attendees, references, activity, payments, and reminders.

### What Tidetime does not do

To be clear about scope:

- There is **no** data-export or "download my data" feature.
- There is **no** per-customer deletion or subject-access tool.

If you need to honour a specific deletion request, the retention window is the only built-in mechanism, and it operates on age, not on individual customers.

## Before you go live

Run through this checklist:

- [ ] company name, logo, default currency, and contact details are correct
- [ ] at least one service is ready
- [ ] availability is set
- [ ] public booking pages look correct
- [ ] email is configured and tested (Integrations → Email)
- [ ] a calendar is connected if needed (Integrations → Calendars)
- [ ] Stripe is configured if needed (Integrations → Payments)
- [ ] legal content is reviewed
- [ ] blocked periods are added if needed
- [ ] one full test booking has been completed

## When something is wrong

If you run into setup issues, use:

- [Integrations](./INTEGRATIONS.md) if a calendar, video, CRM, payment, or email connection is involved
- [Troubleshooting](./TROUBLESHOOTING.md)
- [FAQ](./FAQ.md)
- [Glossary](./GLOSSARY.md)
- [Deployment](./DEPLOYMENT.md) if the issue is server-related
