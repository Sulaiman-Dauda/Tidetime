# Glossary

Terms used across the Tidetime documentation.

**Instance.** One running copy of Tidetime, serving one company.

**Company.** The single organization that owns the instance. Its name, logo, and settings appear on the booking pages and emails.

**Owner.** The account with full control of the instance, including settings, integrations, and transferring or deleting the instance.

**Admin.** A role that can do everything except delete the instance: the service catalog, members, everyone's availability, all bookings, and settings.

**Scheduler.** A front-desk role that manages all bookings and customers and books on behalf of customers, but is not bookable and cannot change the catalog, members, or settings.

**Member.** A regular team member and bookable provider, managing their own availability, bookings, and calendar connection. The default role for invited teammates.

**Provider.** A member assigned to a service to take its bookings. Managed under Members; assigned to services in the service editor.

**Service.** Something a customer can book, with a duration, a location, assigned providers, and scheduling rules.

**Booking.** A confirmed or pending appointment for a service at a specific time, with one assigned provider and one or more attendees.

**Attendee.** A person attending a booking. Group services can have several attendees sharing one slot.

**Slot.** An offered start time for a service, based on provider availability, service rules, and calendar conflicts.

**Schedule.** A named set of availability rules for a provider, such as weekly hours plus date overrides. A provider can have more than one.

**Group event.** A service where several attendees can share one slot, set through seats per slot.

**Daily cap.** A limit on how many bookings a service accepts per calendar day.

**Least-busy assignment.** How Tidetime picks a provider when the customer does not choose one: the available provider with the fewest upcoming bookings.

**Destination calendar.** The Google Calendar that Tidetime writes bookings to for a provider who has connected Google.

**Conflict check.** Reading a connected calendar's busy times so Tidetime does not offer a slot that clashes with an existing event.

**Webhook.** A signed HTTP request Tidetime sends to a URL you control when a booking is created, rescheduled, or cancelled.

**On-demand TLS.** How the bundled Caddy proxy obtains an HTTPS certificate for your custom domain automatically on the first request, gated by the app so it only does so for your configured domain.

**Retention window.** The number of days after which personal data on old bookings is purged automatically.
