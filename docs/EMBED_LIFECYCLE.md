# Tidetime Embed — Lifecycle & Protocol

This document is the contract for embedding a Tidetime booking page in another
site. It specifies the **handshake**, the **frame state machine**, the
**`postMessage` protocol** (with versioning), and the **events** you can
subscribe to. It is the reference both `public/embed.js` (the host SDK) and
`src/app/(public)/embed-bridge.tsx` (the in-frame bridge) implement.

If you just want to drop a widget on a page, see [Quick start](#quick-start).
If you build on top of the embed (custom UI, analytics, SPA integration), read
the [Lifecycle](#lifecycle) and [Protocol](#protocol) sections — they are
stable and versioned, so you can depend on them.

---

## Quick start

**Inline, auto-resizing:**

```html
<div data-tidetime-inline="https://app.tidetime.com/jane/intro"></div>
<script src="https://app.tidetime.com/embed.js" async></script>
```

**Popup trigger (prerendered on hover, opens instantly):**

```html
<button data-tidetime-url="https://app.tidetime.com/jane/intro">Book a call</button>
<script src="https://app.tidetime.com/embed.js" async></script>
```

**Programmatic:**

```js
Tidetime('init', { theme: 'dark' });                 // configure + scan the DOM
Tidetime('inline', { target: '#cal', url: '…' });    // mount an inline embed
Tidetime('prerender', { url: '…' });                 // warm a popup frame
Tidetime('popup', { url: '…' });                     // open (instant if warmed)
Tidetime('floatingButton', { url: '…', text: 'Book' });
Tidetime('on', { event: 'bookingSuccessful', handler: (d) => {} });
```

**React:** use the wrapper at
[`src/components/embed/TidetimeEmbed.tsx`](../src/components/embed/TidetimeEmbed.tsx)
— it handles script loading, lifecycle, and cleanup. See
[React wrapper](#react-wrapper).

---

## Lifecycle

A frame moves through a small, observable state machine. Each transition emits a
host-side event (subscribe with `Tidetime('on', …)`).

```
            create iframe
                 │
                 ▼
          ┌─────────────┐   document load    ┌──────────────┐
          │   loading   │ ─────────────────▶ │ frameLoaded  │   (coarse: DOM ready,
          └─────────────┘                    └──────────────┘    app may not be mounted)
                 │                                   │
                 │  in-frame React mounts            │
                 │  + handshake completes            │
                 ▼                                   ▼
          ┌─────────────┐                     ┌──────────────┐
          │    ready    │ ◀───────────────────│  handshake   │
          └─────────────┘   tidetime:ack      └──────────────┘
                 │
                 │  attendee confirms a booking
                 ▼
          ┌──────────────────────┐
          │  bookingSuccessful    │   (popup auto-closes ~300ms later)
          └──────────────────────┘

   error at any point loading the iframe ──▶ linkFailed
```

### Why the handshake exists

Popups are **prerendered**: the iframe is created and warmed in the background so
the popup opens instantly on click. That creates a race — a prerendered frame can
finish loading *before* the host SDK has attached its `message` listener. A
one-shot "I'm ready" message would be lost and the popup would render blank until
a reload.

To close the race, the in-frame bridge **re-announces readiness on a backoff**
until the host acknowledges:

1. In-frame bridge posts `tidetime:ready` to the parent.
2. It repeats on a backoff (`min(100 * attempt, 1000)` ms, up to 12 attempts)
   until it receives `tidetime:ack`.
3. The host SDK, on the first `tidetime:ready` it sees, replies with
   `tidetime:ack` **and** `tidetime:connect` (carrying host config such as
   theme), then marks the frame `ready` and emits `ready` **once**.

The host's `tidetime:ack` is idempotent: repeated `tidetime:ready` messages after
the frame is already `ready` are ignored (no duplicate `ready` events).

---

## Protocol

All messages are plain objects sent via `window.postMessage`. Every message has:

| field  | type     | meaning                                  |
| ------ | -------- | ---------------------------------------- |
| `type` | string   | namespaced `tidetime:*` message type     |
| `v`    | number   | **protocol version** (currently `1`)     |

Consumers should ignore messages whose `type` they don't recognise and whose `v`
they don't support. New fields are added backwards-compatibly within a version;
a breaking change bumps `v`.

### Frame → Host (sent by the in-frame bridge)

| `type`                        | extra fields        | meaning                                              |
| ----------------------------- | ------------------- | --------------------------------------------------- |
| `tidetime:ready`              | —                   | app mounted; requesting handshake (retried)         |
| `tidetime:resize`             | `height: number`    | new document height (px) for inline auto-sizing     |
| `tidetime:bookingSuccessful`  | booking summary     | a booking was confirmed                             |

### Host → Frame (sent by the SDK)

| `type`              | extra fields              | meaning                                  |
| ------------------- | ------------------------- | ---------------------------------------- |
| `tidetime:ack`      | —                         | handshake acknowledged; stop retrying    |
| `tidetime:connect`  | `theme: 'light'｜'dark'｜null` | apply host config (theme, …)        |

### Host-side events (`Tidetime('on', { event, handler })`)

| event                | payload             | fires when                                              |
| -------------------- | ------------------- | ------------------------------------------------------- |
| `frameLoaded`        | `{ url }`           | the iframe document loaded (coarse signal)              |
| `ready`              | handshake payload   | the in-frame app mounted **and** handshake completed    |
| `bookingSuccessful`  | booking summary     | a booking was confirmed (popup auto-closes after)       |
| `linkFailed`         | `{ url }`           | the iframe failed to load                               |

---

## Security: inbound origin validation

The host SDK (`public/embed.js`) only acts on `postMessage` events that it can attribute to a frame **it created**. When the SDK builds an iframe it records that frame's origin (`frame._ttOrigin`, derived from the booking URL). On every inbound message it then enforces **both** checks before doing anything:

1. The message's `event.source` must match the `contentWindow` of a frame the SDK is tracking (inline, prerendered, or the active modal).
2. `event.origin` must equal that frame's recorded origin.

If either check fails, the message is dropped. This stops any other page or frame on the host site from spoofing `tidetime:ready`, `tidetime:resize`, or `tidetime:bookingSuccessful` into the host's callbacks (for example, faking a `bookingSuccessful` to fire your analytics or auto-close the modal).

### Asymmetry to be aware of

The validation is **one-directional**:

- **Inbound** (frame → host) is origin-validated as described above.
- **Outbound** (host → frame via `tidetime:ack` / `tidetime:connect`, and the in-frame bridge's frame → host posts) is sent with a target origin of `"*"`.

In practice this is safe because the SDK only acts on messages it can attribute to a frame it owns, and the outbound `tidetime:connect` payload carries nothing sensitive (just theme). If you fork the bridge to send sensitive data outbound, tighten the target origin from `"*"` to the host origin yourself.

## Versioning policy

- The current protocol version is **`1`** (`PROTOCOL_VERSION`).
- Within a version, only **additive** changes are made (new optional message
  fields, new event types). Existing fields keep their meaning.
- A breaking change (renamed/removed field, changed semantics) **increments
  `v`**. The host SDK and in-frame bridge negotiate on `v`; mismatched majors are
  ignored rather than mis-handled.
- Pin the SDK by URL (`/embed.js`) from the same deployment that serves your
  booking pages so host and frame always agree on `v`.

---

## React wrapper

[`src/components/embed/TidetimeEmbed.tsx`](../src/components/embed/TidetimeEmbed.tsx)
is a dependency-free React component (copy it into any React app) that:

- loads `embed.js` once (idempotent across instances),
- renders an **inline** auto-resizing embed or a **popup** trigger,
- wires `onReady` / `onBookingSuccessful` / `onLinkFailed` to the lifecycle
  events above, and cleanly unsubscribes on unmount,
- forwards `theme` into the handshake.

```tsx
import { TidetimeEmbed } from "@/components/embed/TidetimeEmbed";

// Inline
<TidetimeEmbed url="https://app.tidetime.com/jane/intro" theme="dark"
  onBookingSuccessful={(d) => analytics.track("booked", d)} />

// Popup
<TidetimeEmbed mode="popup" url="https://app.tidetime.com/jane/intro">
  Book a call
</TidetimeEmbed>
```
