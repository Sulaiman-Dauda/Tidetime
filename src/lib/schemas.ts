import { z } from "zod";
import { isValidTimeZone } from "@/lib/time";

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

export const eventLocationSchema = z.discriminatedUnion("type", [
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
  z.object({ type: z.literal("google_meet") }),
  z.object({ type: z.literal("zoom") }),
]);

export const eventLocationsSchema = z.array(eventLocationSchema).max(10, "Too many locations");

export const bookingFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "select",
  "radio",
  "checkbox",
  "multiselect",
]);

export const bookingFieldConditionSchema = z.object({
  field: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only"),
  equals: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
});

export const bookingFieldSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Field name is required")
      .max(64)
      .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only"),
    label: z.string().trim().min(1, "Field label is required").max(128),
    type: bookingFieldTypeSchema,
    required: z.boolean(),
    placeholder: optionalTrimmedString(200),
    options: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    showWhen: bookingFieldConditionSchema.optional(),
    system: z.boolean().optional(),
    hidden: z.boolean().optional(),
  })
  .superRefine((field, ctx) => {
    const needsOptions =
      field.type === "select" || field.type === "radio" || field.type === "multiselect";
    if (needsOptions && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This field type requires at least one option",
        path: ["options"],
      });
    }
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

      if (field.showWhen) {
        const priorFieldExists = fields.slice(0, index).some((candidate) => candidate.name === field.showWhen?.field);
        if (!priorFieldExists) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Conditional fields must reference an earlier field",
            path: [index, "showWhen", "field"],
          });
        }
      }
    }
  });

export const bookingLimitsSchema = z
  .object({
    day: z.coerce.number().int().min(0).optional(),
    week: z.coerce.number().int().min(0).optional(),
    month: z.coerce.number().int().min(0).optional(),
    year: z.coerce.number().int().min(0).optional(),
  })
  .strict()
  .nullable()
  .optional();

export const currencySchema = z
  .string()
  .trim()
  .length(3, "Use a 3-letter ISO currency code")
  .transform((value) => value.toLowerCase());
