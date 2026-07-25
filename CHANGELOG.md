# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it reaches
a stable release. Published releases and their notes are also available on the
[GitHub Releases](https://github.com/Sulaiman-Dauda/Tidetime/releases) page.

## [Unreleased]

### Security

- Two-factor codes are now single-use. `verifyTotp` only reported whether a code
  was valid, so a code stayed usable for the whole ±1-step acceptance window —
  roughly 90 seconds — and could be replayed to sign in again or to switch 2FA
  back off. RFC 6238 §5.2 requires a verifier to reject the second use of an OTP.
  A new `verifyTotpStep` returns the 30-second step a code matched, the step is
  recorded on the user as `totp_last_step`, and a code is only accepted when its
  step is strictly greater than the one already consumed. Enrolment seeds the
  value so the setup code cannot be turned straight around against a login.
  Requires the `0005` migration; the column is nullable, so existing installs
  keep working and simply have no consumed step recorded until the next sign-in.

### Fixed

- The dashboard was unusable on screens narrower than 768px. The mobile header
  was a sibling of the sidebar inside a row-direction flex container, so it took
  a column of its own and pushed the content area off-screen — every dashboard
  page rendered as a blank screen below the header. The header now sits inside
  the content column.
- Booking times like `10:00 AM` wrapped onto a second line in the overview's
  agenda rows, giving rows in the same list different heights.
- The date label in the booking page's slot column wrapped after the weekday
  when the rail was narrow.
- The calendar's month toolbar overflowed the viewport on phones.

### Changed

- Filters on Bookings, Customers, Calendar and Availability now use the app's
  own select control instead of the unstyled browser dropdown.
- Service rows have a labelled `Preview` and `Edit` action plus an overflow menu
  (move, duplicate, hide, delete) in place of five unlabelled icon buttons with
  an unguarded delete first in the row.
- Settings opens on the Brand tab; Domain, a one-time DNS step, moved last. The
  domain setup steps are a numbered list rather than one run-on line.
- Dark theme: cards and list rows sat too close to the page background to read
  as separate surfaces, and secondary text fell below AA contrast. Card, border
  and muted-foreground tokens were lifted.
- Native date and time fields keep their platform pickers but the indicator
  glyph now matches the surrounding controls.
- Month-grid event chips use compact times (`9am`, `9:45am`) so the meeting
  title has room.
- The calendar's timezone footnote names it as the viewer's own zone and links
  to the profile setting.

## [0.1.2] - 2026-07-25

Maintenance release; no functional changes.

## [0.1.1] - 2026-07-25

### Changed

- The in-app update check now compares the app's semantic version against the
  latest published GitHub release, and the dashboard shows the version number
  (e.g. `v0.1.1`) instead of a git commit. Updates are surfaced only for tagged
  releases, not every commit to `main`.

## [0.1.0] - 2026-07-25

First public release of Tidetime: self-hosted appointment scheduling for a single
company with multiple services and multiple providers.

### Added

- Public booking pages with per-company branding, custom questions, multiple
  durations, buffers, and minimum-notice rules.
- Provider assignment: customers choose a provider or Tidetime assigns the
  least-busy available one, with transactional protection against double-booking.
- Availability built from multiple named schedules per provider, weekly rules with
  date overrides, and admin-managed availability.
- Group events with shared seats per slot, per-service daily caps, and an optional
  confirmation step.
- Google Calendar conflict checks with event write-back to a destination calendar
  and Google Meet links, plus Microsoft 365 read-only conflict checks.
- Built-in Jitsi meeting links, with phone and in-person location options.
- Email over SMTP or a Microsoft 365 mailbox, covering confirmations, reschedules,
  cancellations, attendee RSVP links, and calendar invites.
- Signed, retrying outgoing webhooks on booking events, compatible with Zapier
  Catch Hooks.
- Customer directory with per-customer history and CSV export.
- Custom domains with automatic HTTPS through a bundled Caddy proxy.
- Account security: optional TOTP two-factor authentication, password reset, email
  verification and change, ownership transfer, rate limiting, and ALTCHA spam
  protection.
- Company settings for legal pages, a data-retention window, and locale and time
  zone handling.
- Production Docker Compose stack, a one-command install script that installs
  Docker and its prerequisites, and a background jobs worker for webhook retries
  and data retention.
- In-app update notifications: admins see the running version in the dashboard
  and are alerted when a newer release is available, with an optional one-click
  updater.

[Unreleased]: https://github.com/Sulaiman-Dauda/Tidetime/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/Sulaiman-Dauda/Tidetime/releases/tag/v0.1.2
[0.1.1]: https://github.com/Sulaiman-Dauda/Tidetime/releases/tag/v0.1.1
[0.1.0]: https://github.com/Sulaiman-Dauda/Tidetime/releases/tag/v0.1.0
