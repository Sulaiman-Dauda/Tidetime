# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it reaches
a stable release. Published releases and their notes are also available on the
[GitHub Releases](https://github.com/Sulaiman-Dauda/Tidetime/releases) page.

## [Unreleased]

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
- Production Docker Compose stack, an install script, and a background jobs worker
  for webhook retries and data retention.

[Unreleased]: https://github.com/Sulaiman-Dauda/Tidetime/commits/main
