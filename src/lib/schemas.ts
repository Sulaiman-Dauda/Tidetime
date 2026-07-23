import { z } from "zod";
import { isValidTimeZone } from "@/lib/time";
import { isBlockedHostname } from "@/lib/ssrf";

/** Map Zod issues to a per-field error record for form actions. */
export function fieldErrorsFromIssues(issues: z.ZodIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[issue.path[0] as string] = issue.message;
  return fieldErrors;
}

function optionalTrimmedString(max: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().max(max).optional());
}

export const timeZoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone is required")
  .refine(isValidTimeZone, "Choose a valid IANA timezone");

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .url("Enter a valid URL")
  .refine((value) => /^https?:\/\//i.test(value), "Only http(s) URLs are supported");

/**
 * Like `httpUrlSchema` but additionally rejects URLs pointing at internal hosts
 * (localhost, private IP ranges, cloud metadata). Used for user-registered
 * outbound targets such as webhook subscriber URLs to block SSRF at the door.
 * Authoritative DNS-resolving validation still happens at delivery time.
 */
export const webhookUrlSchema = httpUrlSchema.refine((value) => {
  try {
    return !isBlockedHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}, "URL host is not allowed");

/**
 * Bounded free-form answers to a service's custom booking questions. The keys,
 * value sizes, and field count are all capped so an unauthenticated booker
 * can't stuff megabytes of arbitrary JSON into the `responses` column. Field
 * semantics are validated separately against the service's configured fields.
 */
export const bookingResponsesSchema = z
  .record(
    z.string().max(200),
    z.union([
      z.string().max(5000),
      z.boolean(),
      z.number(),
      z.array(z.string().max(500)).max(100),
    ]),
  )
  .refine((value) => Object.keys(value).length <= 100, "Too many response fields");

/** Additional guest invitees on a booking, capped to a sane maximum. */
export const bookingGuestsSchema = z
  .array(z.string().email())
  .max(20, "Too many guests (maximum 20)");

const eventLocationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("in_person"),
    address: z.string().trim().min(1, "Address is required").max(500),
  }),
  z.object({
    type: z.literal("phone"),
    phone: optionalTrimmedString(64),
  }),
  z.object({ type: z.literal("attendee_phone") }),
  z.object({
    type: z.literal("link"),
    link: httpUrlSchema,
  }),
  z.object({ type: z.literal("jitsi") }),
  z.object({ type: z.literal("google_meet") }),
]);

export const eventLocationsSchema = z.array(eventLocationSchema).max(10, "Too many locations");

const bookingFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "checkbox",
]);

const bookingFieldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Field name is required")
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only"),
  label: z.string().trim().min(1, "Field label is required").max(128),
  type: bookingFieldTypeSchema,
  required: z.boolean(),
  system: z.boolean().optional(),
});

export const bookingFieldsSchema = z
  .array(bookingFieldSchema)
  .max(50, "Too many booking fields")
  .superRefine((fields, ctx) => {
    const names = new Set<string>();
    for (const [index, field] of fields.entries()) {
      if (names.has(field.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field name: ${field.name}`,
          path: [index, "name"],
        });
      }
      names.add(field.name);
    }
  });
