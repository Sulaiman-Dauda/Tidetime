# Admin guide

This guide covers the company-wide settings that owners and admins control: the team, email, branding, legal pages, the custom domain, and data retention. For provider tasks, see the [user guide](./USER_GUIDE.md).

## Roles and access

Tidetime runs one company per instance. Team members are managed under **Members**, and each has one of four roles:

- **Owner** has full control, including company settings, integrations, and transferring ownership.
- **Admin** can do everything except transfer ownership: manage the service catalogue, everyone's availability, all bookings, and company settings. Admins can invite, change, and remove schedulers and members, but not other admins.
- **Scheduler** is a front-desk role. They view and manage every booking and customer and can book on behalf of customers, but cannot change the service catalogue, members, or settings. Schedulers are not meant to take bookings themselves. The service editor does not stop you assigning one as a provider, though, and a scheduler assigned to a service becomes bookable.
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

Under **Settings**, set the company name, logo, and brand colour. These appear on the public booking, confirmation and legal pages, so customers see your identity rather than the product name.

The brand colour is used for buttons, links, the selected date and time, and focus rings on those pages. On light pages a colour that would be hard to read, such as a pale yellow, is deepened just enough to reach 3:1 contrast, and any other colour is used as entered. Dark mode lightens the colour to at least 62% lightness, and further if it still falls short of 3:1, so it reads on a dark page. The dashboard keeps Tidetime's own colours.

The same page sets the **default phone country**. Phone questions on the booking form show a country picker next to the number box, and this is the country it starts on, so most customers just type their number without a dialling code. They can still change it. Numbers are stored in international format (`+447700900123`) whichever way they were entered.

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

Booking links, emails, and calendar redirects switch to the domain automatically. If Google Calendar or Microsoft 365 is set up, also add the new callback URLs to your Google Cloud and Microsoft Entra app registrations, or connecting through them fails. Leave the field empty to go back to the install address.

## Spam protection

The public booking form includes a hidden honeypot field and a timing check that quietly drop obvious bots. For stronger protection you can turn on a privacy-friendly proof-of-work challenge (ALTCHA) under **Settings**. It runs entirely on your server with no third-party service and no tracking.

## Data retention

Under **Settings**, **Legal**, **Data retention**, set **Delete bookings after** to a number of days. Bookings that ended longer ago than that are deleted automatically, with the attendee details and answers they hold. Entries under **Customers** (name, email, phone) are not removed by this; delete those by hand. Set it to zero to keep bookings indefinitely. Use this to match your own privacy commitments.

## Pausing bookings

You can disable public bookings from **Settings**. While disabled, the booking page shows a maintenance message and no new bookings are taken. Existing bookings are unaffected.

## Background jobs

Two housekeeping jobs run on a schedule: retrying failed webhook deliveries and applying data retention. In the production Docker setup a small worker triggers these automatically. See the [deployment guide](./DEPLOYMENT.md) for how it is wired.

## Updates

Tidetime checks GitHub for newer releases and, when the instance is behind, shows admins an **Update available** card at the foot of the sidebar with the old and new version numbers. Release notes are on the [GitHub Releases](https://github.com/Sulaiman-Dauda/Tidetime/releases) page. The check is cached for 30 minutes, so it only queries GitHub occasionally. Nothing updates on its own.

How you apply an update depends on whether the optional updater is enabled:

- **Default (recommended for most):** the card's **Update now** button copies the update command to your clipboard so you can run it on your server. Browsers block this on a plain-HTTP address; use the commands in the [deployment guide](./DEPLOYMENT.md#updates) instead. You stay in full control and nothing on the server has extra privileges.
- **One-click:** enable the updater service and the button pulls the new image and restarts the stack for you. It does not run `git pull`, and it cannot update an install built from source. This requires giving a small helper container access to the Docker socket (host-root-equivalent), so it is off by default. See [enabling one-click updates](./DEPLOYMENT.md#enabling-one-click-updates-optional) in the deployment guide.

Either way, updates preserve your data. Everything, including uploaded logos and avatars, is stored in PostgreSQL, whose Docker volume survives the restart. As always, back up before upgrading.
