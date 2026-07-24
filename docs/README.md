# Documentation

Tidetime is self-hosted appointment scheduling for a single company with multiple services and multiple providers. This folder holds the authoritative documentation. It is plain markdown so it reads well on GitHub, and the project website builds its guides from these same files.

## Where to start

- [Getting started](./GETTING_STARTED.md) covers first run, creating the company, and taking a first booking.
- [User guide](./USER_GUIDE.md) explains day-to-day use: services, availability, and managing bookings.
- [Admin guide](./ADMIN_GUIDE.md) covers company settings, team roles, email, branding, and the custom domain.
- [Integrations](./INTEGRATIONS.md) covers Google Calendar, Microsoft 365, meeting links, and webhooks.
- [Deployment](./DEPLOYMENT.md) is the production setup with Docker, PostgreSQL, and Caddy.
- [Architecture](./ARCHITECTURE.md) describes how the app is put together, for contributors and operators.
- [FAQ](./FAQ.md) answers common questions.
- [Troubleshooting](./TROUBLESHOOTING.md) helps when something is not working.
- [Glossary](./GLOSSARY.md) defines the terms used across these guides.

## What Tidetime is, in one paragraph

One company runs the instance. Customers open a public booking page, choose a service, pick a provider or let Tidetime assign the least-busy available one, and book an open slot. Providers set their own hours, connect a calendar for conflict checks, and manage their bookings from a dashboard. Owners and managers control the service catalog, the team, branding, email, and integrations. Everything runs on your own server and your own PostgreSQL database.

## Project links

- Source code and issues: https://github.com/Sulaiman-Dauda/Tidetime
- [Contributing guide](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)
- [License](../LICENSE)
