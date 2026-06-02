# Tidetime — Competitive Feature Audit & Parity Analysis

> Source-code audit of **Easy!Appointments** (`/home/sulaiman/Downloads/easyappointments-main`)
> and **Cal.diy** (a Cal.com-based monorepo, `/home/sulaiman/Downloads/cal.diy-main`), compared
> against Calendly, Cal.com, Setmore and Easy!Appointments, with a feature-gap analysis and the
> features implemented in this iteration.

Goal: be the best **lightweight, self-hosted** open-source scheduling platform — without the
enterprise bloat (no CRM, marketing automation, SAML/SCIM, AI assistants, workflow builders).

---

## Phase 1 — Codebase Audit

### A. Easy!Appointments (PHP / CodeIgniter)

| Feature                                     | Files                                                                      | Description                                                                    | Complexity |
| ------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| Availability engine                         | `application/libraries/Availability.php`                                   | `get_available_hours`, multi-attendant capacity, advance timeout, future limit | High       |
| Working plans + exceptions                  | `Providers_model.php` (settings JSON), `Working_plan_exceptions_model.php` | Weekly plan + per-date overrides with breaks                                   | Medium     |
| Blocked periods / unavailabilities          | `Blocked_periods_model.php`, `Unavailabilities_model.php`                  | Global blocks + per-provider busy time                                         | Low        |
| Services + categories                       | `Services_model.php`, `Service_categories_model.php`                       | Duration, price, slot interval, `attendants_number`, private                   | Medium     |
| Providers / secretaries / roles             | `Providers_model.php`, `Secretaries_model.php`, `Roles_model.php`          | Bitwise privileges (view/add/edit/delete)                                      | High       |
| Customers + 5 custom fields + notes         | `Customers_model.php`                                                      | Auto-dedupe by email, GDPR consents                                            | Medium     |
| Reschedule/cancel via hash                  | `Booking.php`, `Booking_cancellation.php`                                  | Self-service via opaque hash, rate-limited                                     | Medium     |
| Booking field display/require toggles       | migration `022_add_booking_field_settings`                                 | Configurable required/optional fields                                          | Low        |
| Email confirm/cancel + ICS                  | `Notifications.php`, `Ics_file.php`                                        | PHPMailer + ICS attachment                                                     | Medium     |
| Google + CalDAV two-way sync                | `Google_sync.php`, `Caldav_sync.php`, `Synchronization.php`                | OAuth + CalDAV, sync window config                                             | High       |
| Jitsi meeting links                         | `Jitsi_client.php`                                                         | Auto-generate meeting links                                                    | Low        |
| REST API v1                                 | `application/controllers/api/v1/*`                                         | CRUD for all entities, pagination, `with`, `fields`                            | Medium     |
| Webhooks (HMAC)                             | `Webhooks_client.php`                                                      | save/delete triggers, secret signature                                         | Medium     |
| KV settings + branding                      | `Settings_model.php`, `Business_settings.php`                              | company name/logo/color/theme                                                  | Low        |
| CLI cron (migrate/seed/backup/sync/cleanup) | `Console.php`, `Cleanup.php`                                               | Data retention, backups                                                        | Medium     |
| LDAP, ALTCHA captcha, analytics             | `Ldap_client.php`, `Altcha_client.php`                                     | Enterprise auth + bot defense                                                  | High       |

### B. Cal.diy (Cal.com-based monorepo)

| Feature                                                       | Files                                                | Description                                    | Complexity |
| ------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- | ---------- |
| Event types (buffers, min-notice, slot interval, offsetStart) | `packages/prisma/schema.prisma` (EventType)          | Full config surface                            | Medium     |
| Booking / duration limits                                     | `features/bookings/lib/checkBookingLimits.ts`        | per day/week/month caps                        | Medium     |
| Period types ROLLING/ROLLING_WINDOW/RANGE                     | schema `PeriodType`                                  | Booking windows                                | Medium     |
| Seats / group bookings                                        | `BookingSeat`, `features/bookings/lib/handleSeats`   | Capacity per slot, show attendees/count        | High       |
| Scheduling: round-robin / collective / managed                | `getLuckyUser.ts`, `Host` (priority/weight)          | Weighted RR, fixed hosts, sub-events           | High       |
| Availability + date overrides + OOO                           | `Availability`, `OutOfOfficeEntry`                   | Weekday + date, redirect-to user               | High       |
| Custom booking fields + conditionals                          | `features/form-builder`, `getBookingFields.ts`       | System + custom fields, show-when              | High       |
| Reschedule / cancel / no-show / rating                        | `features/bookings/lib/*`, `Booking.rating`          | Lifecycle + **post-booking rating & feedback** | Medium     |
| Calendar sync (Google/O365/CalDAV/+)                          | `packages/app-store/*calendar`, `CalendarManager.ts` | Two-way sync, conflict detection, cache        | High       |
| Webhooks (18+ triggers, retries, templates)                   | `Webhook`, `WebhookScheduledTriggers`                | Scheduled + retry                              | High       |
| Payments (Stripe/PayPal/BTCPay)                               | `packages/app-store/stripepayment`                   | Deposits, hold                                 | High       |
| Teams / orgs / memberships                                    | `Team`, `Membership`, `Organization`                 | Hierarchy, branding                            | High       |
| Branding / hideBranding / theme / colors                      | `User`/`Team` fields                                 | White-label                                    | Medium     |
| API keys + rate limits + OAuth                                | `ApiKey`, `RateLimit`, `OAuthClient`                 | Programmatic access                            | High       |
| Hashed/temporary booking links                                | `HashedLink`, `features/hashedLink`                  | One-time / expiring                            | Medium     |
| Booking analytics (denormalized views)                        | `BookingDenormalized`                                | Insights                                       | High       |

**Hidden / non-obvious capabilities found:** idempotency keys, iCal UID/sequence, instant
meetings, travel schedules, holiday cache, restriction schedules, blocklist, bot detection,
internal-note presets, no-show-weighted round-robin, embed with custom CSS, tracking/UTM
capture, verified numbers/emails.

**Deliberately excluded from Tidetime** (enterprise bloat): DSync/SAML, platform OAuth,
managed organizations, attribute-based access control, credit system, Cal AI, 100+ app-store
integrations, booking audit log tables.

---

## Phase 2 — Feature Comparison Matrix

Legend: ✅ Complete · 🟡 Partial · ❌ Missing

| Feature                                    | Tidetime   | EasyAppts | Cal.diy | Calendly | Cal.com | Setmore |
| ------------------------------------------ | ---------- | --------- | ------- | -------- | ------- | ------- |
| Unlimited appts/bookings                   | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Event types                                | ✅         | 🟡        | ✅      | ✅       | ✅      | ✅      |
| Group / multi-attendant (seats)            | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Round-robin / collective                   | ✅         | 🟡        | ✅      | ✅       | ✅      | 🟡      |
| Buffers / min-notice / windows             | ✅         | ✅        | ✅      | ✅       | ✅      | 🟡      |
| Booking/frequency limits                   | ✅         | ✅        | ✅      | ✅       | ✅      | 🟡      |
| Availability + date overrides              | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Breaks / vacations (OOO)                   | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Booking approvals                          | ✅         | 🟡        | ✅      | ✅       | ✅      | 🟡      |
| Reschedule / cancel (self-serve)           | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Recurring appointments                     | 🟡         | ❌        | ✅      | ✅       | ✅      | ✅      |
| Customer profiles / notes / no-show        | ✅         | ✅        | ✅      | 🟡       | 🟡      | ✅      |
| Providers / provider pages                 | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Organizations / teams                      | ✅         | 🟡        | ✅      | ✅       | ✅      | ✅      |
| Google / Outlook / CalDAV sync             | 🟡         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Conflict detection                         | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Email notifications                        | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| SMS notifications                          | 🟡         | ❌        | ✅      | ✅       | ✅      | ✅      |
| Payments (Stripe) + deposits               | ✅         | ❌        | ✅      | ✅       | ✅      | ✅      |
| Custom + conditional booking fields        | ✅         | 🟡        | ✅      | ✅       | ✅      | 🟡      |
| File uploads in forms                      | ✅         | ❌        | 🟡      | ✅       | 🟡      | ❌      |
| Inline / popup / floating widgets          | ✅         | 🟡        | ✅      | ✅       | ✅      | ✅      |
| Public / team / provider links             | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| Temporary / one-time / expiring links      | ✅         | ❌        | ✅      | 🟡       | 🟡      | ❌      |
| White-label / branding / colors            | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| **Resource scheduling (rooms/equipment…)** | ✅ _(new)_ | ❌        | ❌      | ❌       | 🟡      | ✅      |
| **Reviews / feedback + Google redirect**   | ✅ _(new)_ | ❌        | 🟡      | ❌       | ❌      | ✅      |
| Analytics (bookings/revenue/no-show)       | ✅         | 🟡        | ✅      | ✅       | ✅      | ✅      |
| REST API + webhooks + API keys             | ✅         | ✅        | ✅      | ✅       | ✅      | 🟡      |
| CSV import / export                        | ✅         | 🟡        | 🟡      | ✅       | 🟡      | ✅      |
| Responsive UI                              | ✅         | ✅        | ✅      | ✅       | ✅      | ✅      |
| **PWA / installable / offline**            | ✅ _(new)_ | ❌        | ❌      | 🟡       | 🟡      | ✅      |

---

## Phase 2 — Gap Analysis (before this iteration)

### Critical (parity-required) — **implemented in this iteration**

1. **Resource scheduling** — rooms, studios, equipment, vehicles, desks with capacity and
   conflict detection (Setmore parity; absent from Calendly/Cal.com core).
2. **Reviews / post-booking feedback** — positive ratings redirect to Google Reviews; negative
   ratings collect private feedback (Setmore/Birdeye-style; a clear differentiator).

### Important — **implemented in this iteration**

3. **Progressive Web App** — installable, offline shell, app manifest (mobile parity without a
   native app).

### Optional / already present (no work needed)

- Seats, round-robin, collective, payments + deposits, booking links, conditional fields, file
  uploads, custom branding, webhooks, REST API + keys, analytics, CSV — already shipped.
- SMS and full two-way calendar sync remain **adapter stubs** by design (avoid mandatory paid
  third-party dependencies in the lean self-hosted default; pluggable when a provider is added).
- Recurring bookings: schema + slot rule exist; multi-occurrence UI is a follow-up.

---

## Phase 3 — Implemented in this iteration

| Area               | What shipped                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Schema             | `resources`, `event_type_resources`, `booking_resources`, `reviews` tables; review settings on `users`/`teams`; `resource_type` enum |
| Migration          | `drizzle/0002_resources_reviews.sql`                                                                                                 |
| Slot engine        | Resource conflicts merged into availability; capacity-aware booking-time check                                                       |
| Server             | `src/server/resources.ts`, `src/server/reviews.ts`; review-request cron; resource linkage in `createBooking`                         |
| Pure libs (tested) | `src/lib/reviews.ts` (rating routing), `src/lib/resources.ts` (capacity/conflict math)                                               |
| REST API           | `/api/v1/resources`, `/api/v1/reviews`                                                                                               |
| UI                 | Dashboard **Resources** + **Reviews**; public `/booking/[uid]/review`; review settings in Settings; sidebar nav                      |
| PWA                | `src/app/manifest.ts`, `public/sw.js`, install/registration, icons                                                                   |
| Tests              | `src/lib/reviews.test.ts`, `src/lib/resources.test.ts`                                                                               |

---

## Unlimited-seat architecture notes

- All hot query paths are indexed: `bookings(user_id,start_time)`, `bookings(status)`,
  `bookings(uid)`, `attendees(booking_id)`, `customers(user_id,email)`, plus new
  `booking_resources(resource_id)` and `reviews(user_id)` indexes for fan-out reads.
- Slot generation is a **pure function** over bounded windows; busy-time and resource queries
  are range-scoped (`start_time < end AND end_time >= start`) so they stay sargable at millions
  of rows.
- Pagination is offset/limit on every list endpoint; reminder & review-request jobs are
  batch-bounded (`LIMIT 500`) and run as idempotent cron workers (`jobs:reminders`).
- No N+1 in list views (joins + denormalized customer stats). Targets: 10k+ providers,
  100k+ customers, 1M+ appointments.

---

## Final Parity Report (estimated, scheduling scope only)

| Competitor            | Parity   | Notes                                                                                                                         |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Easy!Appointments** | **~98%** | Superset of its scheduling + adds payments, links, reviews, PWA, seats. Intentionally omits LDAP/ALTCHA.                      |
| **Cal.DIY (Cal.com)** | **~85%** | Matches core scheduling/teams/payments/webhooks/API. Omits enterprise (DSync, org hierarchy, 100+ apps, AI) by design.        |
| **Calendly**          | **~92%** | Full booking/teams/payments/links/branding/analytics + resources & reviews Calendly lacks. Gap: deep native calendar sync UI. |
| **Cal.com**           | **~85%** | As Cal.DIY.                                                                                                                   |
| **Setmore**           | **~90%** | Adds resources, reviews-to-Google, payments, no-show tracking. Gap: built-in SMS provider, native video.                      |

> Percentages weight **scheduling-relevant** capabilities only; explicitly-excluded enterprise
> features (CRM, SAML/SCIM, AI, marketing) are not counted against parity.
