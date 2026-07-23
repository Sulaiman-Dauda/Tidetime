import type { BookingField } from "@/db/schema";

/** A map of field name -> submitted value (string, boolean, or string[]). */
export type FieldValues = Record<string, string | boolean | string[] | undefined>;

function isEmpty(value: string | boolean | string[] | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{6,}$/;

/**
 * Validate submitted responses against a field schema. Required fields are
 * enforced and type-specific checks run on present values. Returns a
 * map of field name -> error message (empty when valid).
 */
/**
 * Turn stored booking responses into displayable label/value answers, in form
 * order. System fields (name/email) are skipped; `excludeValue` drops the
 * answer that already became the booking description so callers rendering a
 * separate Notes row don't show it twice.
 */
export function answersFromResponses(
  fields: BookingField[],
  responses: Record<string, unknown>,
  excludeValue?: string | null,
): { label: string; value: string }[] {
  const answers: { label: string; value: string }[] = [];
  for (const field of fields) {
    if (field.system) continue;
    const value = responses[field.name];
    let rendered: string | null = null;
    if (typeof value === "string" && value.trim()) rendered = value.trim();
    else if (typeof value === "number") rendered = String(value);
    else if (value === true) rendered = "Yes";
    if (rendered === null) continue;
    if (excludeValue && rendered === excludeValue) continue;
    answers.push({ label: field.label, value: rendered });
  }
  return answers;
}

export function validateResponses(
  fields: BookingField[],
  values: FieldValues,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    // Skip system fields – they are validated separately by the hardcoded
    // form inputs and server-side Zod schema.
    if (field.system) continue;

    const value = values[field.name];

    if (field.required && isEmpty(value)) {
      errors[field.name] = `${field.label} is required`;
      continue;
    }
    if (isEmpty(value)) continue;

    if (field.type === "email" && typeof value === "string" && !EMAIL_RE.test(value)) {
      errors[field.name] = "Enter a valid email";
    } else if (field.type === "phone" && typeof value === "string" && !PHONE_RE.test(value)) {
      errors[field.name] = "Enter a valid phone number";
    } else if (field.type === "number" && typeof value === "string" && Number.isNaN(Number(value))) {
      errors[field.name] = "Enter a valid number";
    }
  }

  return errors;
}
