# Admin guide

This guide covers the company-wide settings that owners and admins control: the team, email, branding, legal pages, the custom domain, and data retention. For provider tasks, see the [user guide](./USER_GUIDE.md).

## Roles and access

Tidetime runs one company per instance. Team members are managed under **Members**, and each has one of four roles:

- **Owner** has full control, including company settings, integrations, and transferring or deleting the instance.
- **Admin** can do everything except delete the instance: manage the service catalog, members, everyone's availability, all bookings, and company settings.
- **Scheduler** is a front-desk role. They view and manage every booking and customer and can book on behalf of customers, but they are not bookable themselves and cannot change the service catalog, members, or settings.
- **Member** is a regular team member and bookable provider. They take appointments and manage their own availability, bookings, and calendar connection.

A **provider** is a member assigned to a service to take its bookings; owners and admins can be assigned as providers too. These limits are enforced in the server, not only hidden in the interface.

### Inviting the team

Add people under **Members** and send an invite by email. The invite is a one-time link tied to their address. When they accept and set a password, they join the company with the role you chose.

### Transferring ownership

An owner can transfer ownership to another accepted member from the **Members** page. Use this before handing the instance to someone else.

## Email delivery

Tidetime sends confirmation, reschedule, and cancellation emails. Set this up under **Connections**. There are two options:

- **SMTP**, using any mail server. Enter the host, port, and credentials, then send a test.
- **Microsoft 365**, using a connected mailbox through Microsoft Graph.

You can keep both configured and choose which one is active. See the [integrations guide](./INTEGRATIONS.md) for the Microsoft 365 setup steps.

## Branding

Under **Settings**, set the company name, logo, and brand color. These appear on the public booking pages and in emails, so customers see your identity rather than the product name.

The same page sets the **default phone country**. Phone questions on the booking form show a country picker next to the number box, and this is the country it starts on — so most customers just type their number without a dialling code. They can still change it. Numbers are stored in international format (`+447700900123`) whichever way they were entered.

## Legal pages

Under **Settings**, you can turn on and write:

- A cookie notice shown as a banner on public pages.
- Terms and conditions, served at `/legal/terms`.
- A privacy policy, served at `/legal/privacy`.

You can also link an external legal notice. Turn on only what applies to you.

## Custom domain and HTTPS

Serve your booking pages from your own domain over HTTPS with no certificate files to manage:

1. Under **Settings**, go to **Domain** and save your domain, for example `book.yourcompany.com`.
2. At your DNS provider, create an A record for that domain pointing at your server's IP address.
3. Back in Settings, use **Check status**. On the first HTTPS request, the bundled Caddy proxy obtains a Let's Encrypt certificate for the domain and keeps it renewed.

Booking links, emails, and calendar redirects switch to the domain automatically. Leave the field empty to go back to the install address.

## Spam protection

The public booking form includes a hidden honeypot field and a timing check that quietly drop obvious bots. For stronger protection you can turn on a privacy-friendly proof-of-work challenge (ALTCHA) under **Settings**. It runs entirely on your server with no third-party service and no tracking.

## Data retention

Under **Settings**, you can set a data retention window in days. Personal data on old bookings is purged automatically after that period. Set it to zero to keep everything. Use this to match your own privacy commitments.

## Pausing bookings

You can disable public bookings from **Settings**. While disabled, the booking page shows a maintenance message and no new bookings are taken. Existing bookings are unaffected.

## Background jobs

Two housekeeping jobs run on a schedule: retrying failed webhook deliveries and applying data retention. In the production Docker setup a small worker triggers these automatically. See the [deployment guide](./DEPLOYMENT.md) for how it is wired.

## Updates

Tidetime checks GitHub for newer versions and shows admins a banner in the dashboard when the instance is behind, with a link to exactly what changed. The check is cached, so it only queries GitHub occasionally.

How you apply an update depends on whether the optional updater is enabled:

- **Default (recommended for most):** the banner's **Update now** button reveals the one command to run on your server. You stay in full control and nothing on the server has extra privileges.
- **One-click:** enable the updater service and the button pulls the new image and restarts the stack for you. This requires giving a small helper container access to the Docker socket (host-root-equivalent), so it is off by default. See [enabling one-click updates](./DEPLOYMENT.md) in the deployment guide.

Either way, updates preserve your data — the database and uploaded files live in Docker volumes that survive the restart. As always, back up before upgrading.
