# FAQ

## What is Tidetime?

Tidetime is a scheduling platform for managing services, availability, booking pages, appointments, teams, reminders, and related workflow.

## Who is Tidetime for?

Tidetime works well for people and teams who take bookings, such as consultants, service businesses, educators, clinics, agencies, and internal teams.

## Is Tidetime already hosted for me?

This repository is for a **self-hosted** product.

That means someone needs to run Tidetime on a server.

If your company already has Tidetime running, you can simply use it through the web browser and ignore the hosting details.

## Do I need technical skills to use Tidetime?

Not usually.

If Tidetime is already installed and you only need to use the app, the user guides are written for non-technical people.

If you want to install Tidetime yourself, you or someone on your team will need technical knowledge.

## How do I start taking bookings quickly?

Use this order:

1. complete your profile
2. create a service
3. set availability
4. preview the booking page
5. make one test booking
6. share the link

See [Getting Started](./GETTING_STARTED.md).

## What is the difference between a service and a booking?

A **service** is what people can choose to book.

A **booking** is the actual appointment created after someone chooses a time.

## Can I have more than one service?

Yes.

You can create as many services as your workflow needs.

## Can I hide a service without deleting it?

Yes.

You can keep a service in Tidetime but hide it from the public booking page.

This is useful for private offers, unfinished services, or temporary changes.

## Can I stop public bookings for a while?

Yes.

Admins can use **Settings → Booking → Disable public bookings** to pause public bookings without deleting services.

## Can I make customers pay when they book?

Yes, if Stripe is configured and the service is set to require payment.

If you do not use paid bookings, you can leave Stripe disabled.

## Can Tidetime sync with Google Calendar?

Yes.

Tidetime can read busy time from Google Calendar and create events for new bookings.

This requires Google Calendar to be connected in the app and the server-side Google credentials to be configured.

## Do I need Stripe or Google Calendar to use Tidetime?

No.

Both are optional.

Tidetime can still be useful without them.

## What happens if email is not configured?

Tidetime logs emails to the server console instead of sending them.

For real customer communication, configure SMTP in **Settings → Email**.

## What is a booking link?

A booking link is a special link you create for more controlled sharing.

Examples:

- a one-time booking link
- an invite-only link
- a link that expires
- a link with limited uses

## What is the difference between Profile settings and Settings?

- **Profile settings** are for your personal account
- **Settings** are for workspace-wide company configuration

If you want to change your name or password, use **Profile settings**.

If you want to change branding, email, or payment setup, use **Settings**.

## Can I manage a team inside Tidetime?

Yes.

You can create teams, invite members, assign roles, and run shared services.

## What are resources used for?

Resources are shared items that should not be overbooked.

Examples include rooms, equipment, and other limited assets.

## What are reviews used for?

Tidetime can send feedback requests after a booking.

Positive ratings can be sent to your public review page, while lower ratings stay private inside the app.

## I only want to use the app. Which docs should I read?

Start with:

- [Getting Started](./GETTING_STARTED.md)
- [User Guide](./USER_GUIDE.md)
- [Glossary](./GLOSSARY.md)

## I am the admin. Which docs should I read?

Start with:

- [Admin Guide](./ADMIN_GUIDE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

## I want to install Tidetime myself. Which docs should I read?

Start with:

- [README](../README.md)
- [Deployment](./DEPLOYMENT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
