# Frequently asked questions

## Is Tidetime free?

Yes. It is open source under the MIT license. There is no hosted plan and no paid tier. You run it on your own server.

## Can it schedule for more than one company?

No. Tidetime is designed for a single company per instance, on purpose. One team, one service catalog, one set of settings. If you need to schedule for several unrelated organizations, run a separate instance for each.

## What do I need to run it?

A server with Docker and the Docker Compose plugin, and a domain if you want public HTTPS booking pages. It ships with its own PostgreSQL database in the production Compose file, so there is nothing else to set up.

## Does it send appointment reminders?

Not at the moment. Tidetime sends confirmation, reschedule, and cancellation emails, and attendees get a calendar invite they can add to their own calendar. Timed reminder emails, such as a message a day before, are not built in yet.

## How are providers chosen for a booking?

The customer can pick a specific provider, or leave it open. When it is left open, Tidetime assigns the least-busy available provider based on their upcoming bookings. One provider is assigned per booking. There is no round-robin rotation or shared multi-host meeting.

## Does it sync both ways with my calendar?

With Google Calendar, Tidetime reads your busy times to avoid clashes and writes each booking to a calendar you choose, keeping it updated. With Microsoft 365, it reads busy times only and does not write events. It is conflict checking plus one-way writes to Google, rather than full two-way sync.

## Which video tools are supported?

Jitsi is built in and needs no account. Google Meet links are created when Google Calendar is connected. Other providers such as Zoom or Teams are not integrated.

## Can customers pay when booking?

No. Tidetime does not handle payments.

## Is there an API or an embeddable widget?

No. Bookings happen on the hosted booking page. There is a signed webhook for outgoing booking events, but no public API for reading or writing data and no embed widget.

## How is my data protected?

Everything runs on your server and your database. Passwords are hashed with scrypt, sessions are stored as hashed tokens, and stored integration credentials are encrypted at rest. Optional two-factor authentication, rate limiting, and spam protection are built in. See the [security policy](../SECURITY.md) for the full list.

## Can I use my own domain?

Yes. Save the domain in Settings, point its DNS at your server, and the bundled Caddy proxy obtains and renews an HTTPS certificate automatically. See the [admin guide](./ADMIN_GUIDE.md).

## How do I upgrade?

Pull the latest version and restart the containers. The app applies database migrations on startup. Always back up your database first. See the [deployment guide](./DEPLOYMENT.md).

## How can I help?

Stars, bug reports, and pull requests are all welcome. See the [contributing guide](../CONTRIBUTING.md) to get started.
