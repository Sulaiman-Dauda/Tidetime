# Admin Guide

This guide is for the person who manages a Tidetime workspace.

That may be the owner, a company admin, or a team lead with the right permissions.

If you only want to use Tidetime for your own day-to-day booking work, read the [User Guide](./USER_GUIDE.md) instead.

## What an admin usually manages

Admins are usually responsible for:

- brand and company details
- public booking behavior
- email setup
- Google Calendar connections
- Stripe payments
- reviews and feedback routing
- team structure
- categories and shared resources
- legal notices and data retention settings
- company-wide closures

## A simple go-live order

If you are setting up Tidetime for the first time, this is a good order:

1. create the owner account
2. update company branding
3. create the first services
4. set availability
5. configure email
6. connect Google Calendar if needed
7. configure Stripe if you charge for bookings
8. review legal settings
9. test the full booking flow
10. share the booking page

## Settings overview

Open **Dashboard → Settings**.

You will see several sections.

## Brand

Use **Settings → Brand** to control how Tidetime looks to customers.

You can set:

- company name
- company email
- website link
- logo URL
- brand colour

These details appear across the booking experience and customer emails.

### Best practice

Keep the company name, email, logo, and website consistent with your public brand so customers know they are booking with the right business.

## Booking

Use **Settings → Booking** to control public booking behavior.

You can manage:

- **Disable public bookings** — temporarily stop all public bookings
- **Future booking limit** — how far ahead people can book
- **Minimum booking notice** — how soon before a slot someone is allowed to book
- **Reschedule/cancel timeout** — how close to the appointment changes are blocked
- **Appointment status labels** — the status words used inside the system

### When to use “Disable public bookings”

Turn this on when you want to pause all new bookings without deleting services.

Useful examples:

- company holiday
- maintenance window
- temporary closure
- internal changes before relaunch

## Email

Use **Settings → Email** to configure outgoing email.

This controls emails such as:

- booking confirmations
- cancellations
- reminders
- other customer notifications

You can save:

- SMTP host
- port
- username
- password
- from address

Use **Test connection** before going live.

### Important note

If email is not configured, Tidetime falls back to logging emails to the console instead of sending them.

## Calendar

Use **Settings → Calendar** to connect Google Calendar.

Once connected, Tidetime can:

- check busy time to avoid conflicts
- create new booking events on your Google Calendar

You can choose:

- which Google calendars Tidetime should check for conflicts
- which calendar should receive new bookings

### Important note

Google Calendar also needs Google client credentials in the server environment.

If the Google connect flow is unavailable, ask the person who deployed Tidetime to check the deployment settings.

## Stripe

Use **Settings → Stripe** if you want to accept payment for services.

You can save:

- publishable key
- secret key
- webhook secret

You can also test the secret key from inside the app.

### Before paid bookings will work

Make sure all of these are true:

- Stripe keys are saved correctly
- the webhook secret is saved
- Stripe is sending events to Tidetime's webhook endpoint
- the service itself is set to require payment

If you do not charge for bookings, you can skip this section.

## Reviews

Use **Settings → Reviews** to control follow-up feedback requests.

You can:

- turn review requests on or off
- set the public review URL
- choose the rating level that counts as positive enough for public redirect

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

### Best practice

Treat API keys like passwords:

- keep them private
- store them securely
- remove old keys you no longer need
- create separate keys for separate tools when possible

## Legal

Use **Settings → Legal** to manage public legal text and links.

You can configure:

- cookie notice
- terms and conditions
- privacy policy
- legal notice URL
- imprint URL
- data retention days

This helps you present the information customers may need when booking.

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

## Resources

Open **Dashboard → Resources** to manage shared rooms, equipment, and other limited assets.

Use resources when a booking needs something beyond a person.

Examples:

- treatment room
- conference room
- camera kit
- company car

After creating a resource, attach it to the relevant service.

Tidetime then helps prevent double-booking beyond that resource's capacity.

## Teams and roles

Open **Dashboard → Teams** to create and manage team spaces.

Tidetime includes these team roles:

- **Owner** — full control
- **Admin** — almost full control, except the most sensitive owner-only actions
- **Manager** — manages people and scheduling work
- **Provider** — focuses on services, availability, and bookings
- **Receptionist** — focuses on viewing and managing bookings
- **Member** — basic visibility with limited control

Use roles to keep access clear and avoid giving everyone the same level of control.

## Service setup tips for admins

Even if team members create their own services, admins should still check that:

- service names are clear
- public pages are branded properly
- availability rules are realistic
- booking questions are not overly long
- paid services have the right payment settings
- hidden services are only hidden on purpose

## Before you go live

Run through this checklist:

- [ ] company name, logo, and contact details are correct
- [ ] at least one service is ready
- [ ] availability is set
- [ ] public booking pages look correct
- [ ] email is configured and tested
- [ ] Google Calendar is connected if needed
- [ ] Stripe is configured if needed
- [ ] legal content is reviewed
- [ ] blocked periods are added if needed
- [ ] one full test booking has been completed

## When something is wrong

If you run into setup issues, use:

- [Troubleshooting](./TROUBLESHOOTING.md)
- [FAQ](./FAQ.md)
- [Glossary](./GLOSSARY.md)
- [Deployment](./DEPLOYMENT.md) if the issue is server-related
