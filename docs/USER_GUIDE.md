# User Guide

This guide explains the main parts of Tidetime in plain English.

If you are brand new, start with [Getting Started](./GETTING_STARTED.md) first.

## Your normal daily workflow

A simple daily routine in Tidetime usually looks like this:

1. check your upcoming bookings
2. review your calendar for the day or week
3. update services or availability if needed
4. follow up with customers
5. review feedback and team activity when relevant

## What each dashboard area does

| Area | What it is for |
| --- | --- |
| **Overview** | Quick summary of your booking activity and main booking link |
| **Calendar** | A calendar view of accepted and pending bookings |
| **Bookings** | Full list of appointments, including details and status |
| **Customers** | People who have booked with you |
| **Services** | The bookable offerings you publish |
| **Categories** | Groups that help people browse services more easily |
| **Availability** | Your working hours and special date changes |
| **Booking Links** | Special-purpose links such as invite-only or expiring links |
| **Routing Forms** | Public forms that send each respondent to the right service, link, or message |
| **Meeting Polls** | Propose several times and let people vote on the best slot |
| **Analytics** | Summary numbers and trends for your bookings |
| **Reviews** | Feedback left after bookings |
| **Teams** | Shared workspaces and member roles |
| **Integrations** | Calendars, video, CRM, payments, and email connections |
| **Settings** | Workspace branding, booking defaults, reviews, API keys, and legal pages (admins) |
| **Profile settings** | Your personal account details and preferences |

> The sidebar groups these areas. The everyday areas (Overview, Calendar, Bookings, Customers, Services, Availability, and so on) are always visible. The power features (Categories, Booking Links, Routing Forms, Meeting Polls) sit under a collapsible **Advanced** section, and admin areas (Integrations, Settings, Blocked Periods) sit under **Admin**.

## Overview

The **Overview** page is a good starting place when you sign in.

Use it to:

- quickly copy your main booking link
- see a high-level summary of activity
- jump into the rest of the dashboard

## Calendar

The **Calendar** page gives you a visual schedule.

Use it when you want to:

- see what is booked this month
- spot busy days quickly
- open booking details from the calendar

This is useful when you think in dates rather than lists.

## Bookings

The **Bookings** page is where you manage appointments directly.

Typical things you can do here:

- review accepted or pending bookings
- open a booking to see attendee details
- confirm a booking if the service requires approval
- cancel or reschedule when needed

If someone tells you they booked but you are not sure what happened, this is one of the first places to check.

Attendees can help themselves too. From the link in their booking email they can reschedule or cancel, and they can mark whether they are attending, declined, or tentative (an RSVP). For a recurring series, rescheduling and cancelling are handled across the whole series.

## Customers

The **Customers** page keeps a clean list of the people who have booked with you.

Tidetime groups bookings by customer email so you do not end up with a messy list full of duplicates.

Use this page to:

- find a customer quickly
- see how many times they have booked
- check their most recent booking
- review basic contact details

## Services

A **service** is something people can book.

Examples:

- 30-minute consultation
- follow-up session
- haircut
- group class
- onboarding call

In **Services** you can:

- create new services
- edit existing ones
- hide services from your public page
- duplicate a service to save time
- preview the public booking page
- change the display order

### Good service setup habits

For each service, make sure:

- the title is clear
- the description is short and helpful
- the duration is correct
- the location is correct
- the service is only public when you are ready

### Service options

The service editor groups its options into tabs. Here is what you can control.

**Scheduling and length**

- **Durations** — offer one length, or several lengths the booker can choose from
- **Before and after buffers** — protect time on either side of a booking
- **Minimum booking notice** — block last-minute bookings
- **Slot interval** — how far apart the offered start times are
- **Start offset** — shift the first available time of a slot
- **Booking window** — a rolling number of days into the future, or an unlimited window

**Booking form**

- Name and email are always asked.
- You can add your own questions. There are nine field types: short text, long text, email, phone, number, dropdown (select), single choice, checkbox, and multiple choice.
- Each question can be required or hidden, and can use simple conditional logic so it only appears when an earlier answer matches a value you set.
- You can also let bookers invite extra guests by email, or turn guests off.

**Confirmation and payment**

- **Requires confirmation** — hold a booking as pending until you accept it
- **Payment** — collect a deposit or full payment through Stripe when it is connected
- **Success redirect URL** — send the booker to your own page after they finish

**Seats per slot**

Turn this on when several people should be able to book the same time, such as a class or group session. Set how many seats each slot has, and Tidetime fills them until the slot is full. This is the feature to use for group capacity.

**Recurring services**

A service can repeat for the booker. Choose weekly or monthly, set how many units to skip between occurrences (1 to 12), and how many occurrences to create (up to 52). The booker reserves the whole series in one step.

**Team scheduling**

When a service belongs to a team, you can choose how hosts are assigned. See [Teams](#teams) below.

## Availability

**Availability** controls when people are allowed to book.

This is one of the most important areas in Tidetime.

Use it to set:

- your normal weekly working hours
- one-off changes for specific dates (date overrides)

To take a day off, add a date override for that date and leave it with no time intervals. That marks the whole day as unavailable. There is no separate holiday feature; a date override is how you handle holidays and special days.

A good rule:

- use **Availability** for your own schedule and days off
- use **Blocked Periods** for company-wide closures if you are an admin

**Blocked Periods** is an admin feature and needs the team-manage permission, so most users will only use **Availability**.

## Categories

**Categories** help organize services on your booking page.

They are useful when you offer several services and want people to browse faster.

Examples:

- Consultations
- Classes
- Team sessions
- Paid services

## Routing Forms

A **routing form** is a public form that sends each person to the right place based on their answers.

Build the form with the questions you need. Then add routing rules. When someone submits the form, Tidetime checks your rules in order and uses the first one that matches all of its conditions. Each rule sends the respondent to one of three places:

- **Book a service** — open a specific service so they can pick a time
- **Go to a URL** — send them to any web address you choose
- **Show a message** — display a message and stop

You also set a fallback for when no rule matches, so no one is ever left stranded.

A rule can check answers with conditions such as equals, does not equal, contains, or is any of a list. All conditions in a rule must be true for that rule to fire.

The public form lives at a link like `/forms/your-form-slug`. Share that link wherever you want people to start, such as a contact page or an email.

Routing forms are useful for sending the right enquiry to the right service, such as routing sales questions to a demo and support questions to a help page.

## Meeting Polls

A **meeting poll** lets you propose several times and let people vote on the best one. This is for when you do not yet know which time works for everyone.

To run a poll:

1. Open **Meeting Polls** and create a poll with a title, an optional description and location, and a duration (15, 30, 45, 60, or 90 minutes).
2. Add the date and time options you want people to consider.
3. Share the public voting link (it looks like `/poll/your-poll-token`).
4. Each participant votes **yes**, **no**, or **if need be** on each option. They can come back and change their votes; Tidetime prefills their previous answers when they use the same email.
5. When you are ready, pick the winning time. Tidetime ranks options for you, then creates a confirmed booking for everyone who said yes or if-need-be on that option and emails them the details.

You control how much voters can see:

- **Everyone sees all votes** — every participant's choices are visible to all
- **Show totals only** — voters see the tallies but not who voted how
- **Each voter sees only their own** — voters see the totals plus their own choices

You can also turn on **hide participant names** so voters appear as "Participant 1", "Participant 2", and so on. As the poll owner you always see the full results with real names.

## Booking Links

**Booking Links** are special links for more controlled sharing.

Use them when you do not want to share your general public page.

Tidetime supports links that can be:

- **single use**
- **invite only**
- **limited to a certain number of bookings**
- **set to expire**

These are useful for VIP invites, one-time offers, and private scheduling.

## Reviews

The **Reviews** area shows feedback from attendees after a booking.

After a booking, attendees can be asked to rate it. Each host sets a star **threshold** (4 or higher, or 5 only) and a **Google review URL** under **Settings → Reviews**. When a rating meets or beats the threshold, the attendee is sent to your public Google review link. Lower ratings are kept private as feedback so you can act on them quietly.

Use this page to:

- read private feedback
- understand service quality over time
- follow up on issues before they become bigger problems

## Teams

The **Teams** area is for shared work.

Use it when several people need to work inside the same scheduling setup.

Teams are helpful for:

- shared services
- shared responsibilities
- member roles and permissions

If you only run a solo workflow, you may not need this area right away.

### Team scheduling styles

A team service can assign hosts in one of these ways:

- **Round-robin** — one host is chosen per booking from those who are free. You can spread bookings sequentially, send them to the least-busy host, or pick at random. A booker can request a specific provider, or leave it as "any available".
- **Collective** — every listed host must be free, and they all attend the booking.
- **Multi-attendant** — a single booking takes a set number of staff. Tidetime fills the roster with the least-busy available hosts until enough staff are attached.

### Member roles

Each team member has a role that controls what they can do:

- **Owner** — full control of the team
- **Admin** — everything except deleting the team and billing
- **Manager** — invite and remove members, manage services and availability, view and manage bookings, and see analytics; no structural or billing changes
- **Provider** — manage their own services and availability, and view their own bookings
- **Receptionist** — view and manage bookings, with no configuration access
- **Member** — read-only access

## Analytics

The **Analytics** area gives you a simple picture of activity.

It shows real numbers for a time range you choose:

- total bookings
- completed bookings
- upcoming bookings
- cancelled bookings
- no-shows
- revenue, in your default currency
- completion rate

This is useful when you want to understand what is growing, slowing down, or working well.

## Profile settings

Open your account menu and choose **Profile settings** for your personal account details.

This is where you can update:

- name
- username
- bio
- avatar
- time zone
- time format
- week start day
- password

This is different from **Settings** and **Integrations**, which are for workspace-wide admin configuration.

## Helpful habits

These small habits keep Tidetime clean and easy to manage:

- review tomorrow's bookings at the end of each day
- keep service names short and clear
- test a service after major changes
- hide services you do not want public yet
- use categories if your list of services starts growing
- keep your availability accurate
- read private reviews regularly

## When to use which page

### “I need to change when people can book me.”
Use **Availability**.

### “I need to change what people are booking.”
Use **Services**.

### “I need to check an appointment.”
Use **Bookings** or **Calendar**.

### “I need to share a special private link.”
Use **Booking Links**.

### “I want to update my name, time zone, or password.”
Use **Profile settings**.

### “I need to connect a calendar, email, payments, or video.”
Use **Integrations** if you are an admin.

### “I need to update company branding, booking defaults, reviews, or legal pages.”
Use **Settings** if you are an admin.

### “I need to gather everyone's availability before booking.”
Use **Meeting Polls**.

### “I want a form that sends people to the right service.”
Use **Routing Forms**.

## Related guides

- [Getting Started](./GETTING_STARTED.md)
- [Admin Guide](./ADMIN_GUIDE.md)
- [FAQ](./FAQ.md)
- [Glossary](./GLOSSARY.md)
