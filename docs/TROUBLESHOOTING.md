# Troubleshooting

Common problems and how to resolve them. If none of these fit, search existing issues or open a new one at https://github.com/Sulaiman-Dauda/Tidetime/issues.

## The app will not start in production

The app validates its configuration on boot and exits if something required is missing or weak. Check the container logs:

```bash
docker compose -f docker-compose.prod.yml logs app
```

Make sure `APP_URL`, `DATABASE_URL`, `AUTH_SECRET`, and `CRON_SECRET` are set, and that `AUTH_SECRET` and `CRON_SECRET` are at least 32 characters. The production Compose file also refuses to start with a default database password.

## The setup page redirects to login

Setup is only available while the instance has no users. Once the first owner account exists, `/setup` sends you to the login page. This is expected. If you need to start over, reset the database, then migrate and seed again. This deletes all data.

## Customers see "not reachable yet" for the custom domain

The HTTPS certificate is issued on the first request after DNS resolves. Check that:

- The domain's A record points at this server's IP address.
- Ports 80 and 443 are open to the internet.
- You saved the exact domain in Settings.

Give DNS a few minutes to propagate, then use **Check status** again.

## No emails are being sent

Email is off until you configure it. Under **Connections**, set up SMTP or Microsoft 365 and send a test. If the test fails:

- For SMTP, confirm the host, port, and credentials, and that your provider allows sending from this server.
- For Microsoft 365, confirm the app registration, the callback URL, and that the mailbox can send.

## A provider's calendar is not blocking slots

Confirm the provider connected their calendar under the dashboard and selected the calendars to check. For Google, also confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. If a previously working connection stopped, it may need reconnecting after a password or permission change; the dashboard shows when a reconnect is needed.

## Webhooks are not arriving

Check that:

- The target URL is publicly reachable over HTTP or HTTPS. Private and loopback addresses are rejected on purpose.
- You selected the events to send.
- Your endpoint responds within ten seconds.

Failed deliveries retry with backoff, so a temporary outage recovers on its own. Verify the `X-Tidetime-Signature-256` signature on your side using the shared secret.

## Rate limited on login or booking

Repeated attempts from one address are throttled to slow down abuse. Wait a few minutes and try again. Behind a reverse proxy, make sure the proxy passes the real client address so limits apply per visitor rather than to everyone at once.

## Background jobs are not running

In the production Compose setup, a worker container triggers the jobs endpoint on an interval. Confirm the `jobs` service is running:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs jobs
```

The worker needs `CRON_SECRET` set to the same value the app uses.

## Resetting a local development database

```bash
npm run db:reset -- --confirm <database_name>
npm run db:migrate
npm run db:seed
```

The reset command refuses to run in production mode, against remote hosts, or without a matching database name.
