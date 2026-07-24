# User guide

This guide covers day-to-day use for providers and schedulers: services, availability, the booking page, and managing bookings. For company-wide settings, see the [admin guide](./ADMIN_GUIDE.md).

## Services

A service is something customers can book. Create and edit services under **Services**. Each service has:

- A name, description, and duration. You can offer more than one duration on the same service.
- A location: in person, a phone call the provider makes, a phone number the attendee provides, a plain link, a Jitsi meeting, or a Google Meet link when Google Calendar is connected.
- One or more assigned providers.
- Optional intake questions that the customer answers when booking.
- Scheduling rules: buffers before and after, minimum notice, and the interval between offered slots.
- Optional confirmation step, so a booking stays pending until a provider accepts it.
- A daily cap, so a service accepts only so many bookings per calendar day.
- Group seats, so several people can share one slot for group sessions. Leave this at one for one-on-one bookings.

Services can be hidden or left as drafts while you set them up, and you can order them on the public page.

## Providers and assignment

Every service has at least one assigned provider. When a customer books:

- They can choose a specific provider, or leave it on "any available".
- When it is left open, Tidetime assigns the least-busy available provider, measured by upcoming bookings. Exactly one provider is assigned per booking.

This keeps work spread across the team without anyone managing a rota by hand.

## Availability

Set working hours under **Availability**. Availability is built from schedules:

- Each provider can have one or more named schedules, such as "Working hours" or "Evening clinic", and a default schedule.
- A schedule has weekly rules (for example Monday to Friday, 9 to 5) and can include date-specific overrides.
- Owners and admins can manage other providers' availability. Providers manage their own.

A time is offered to customers only when the provider is available, the slot is inside the service rules, and there is no conflict on a connected calendar.

## The booking page

The public booking page lives at `/book/<company-slug>`. It lists your bookable services. Choosing one opens the booking flow: pick a provider or leave it open, choose a date and time in your own time zone, answer any questions, and confirm.

If a service requires confirmation, the customer sees that the booking is pending until a provider accepts it.

## Managing bookings

Open **Bookings** in the dashboard to see upcoming, pending, past, and cancelled bookings. From here you can:

- Confirm or reject bookings that require confirmation.
- Reschedule or cancel a booking. The customer is emailed and the calendar invite is updated.
- Open a booking to see its details and its activity timeline.

The dashboard **Calendar** shows bookings in a week or day view. You can drag on the calendar to create a manual booking or drag an existing one to reschedule it.

## Attendee responses and calendar files

Confirmation emails include Accept, Decline, and Tentative links so attendees can respond, and an `.ics` calendar file so the booking drops straight into their calendar app. Updates and cancellations carry a version number so Outlook and Apple Calendar keep the entry in sync.

## Customers

Everyone who books is recorded under **Customers**, de-duplicated by email. Each customer has a history of their bookings, and you can export the directory to CSV. If a customer asks to be removed, you can delete their record.
