import type { BookingField } from "@/db/schema";

/** A map of field name -> submitted value (string, boolean, or string[]). */
export type FieldValues = Record<string, string | boolean | string[] | undefined>;

/**
 * Whether a field should be visible given the current responses. A field with
 * a `showWhen` condition is hidden until the referenced field holds one of the
 * listed values. Fields without a condition are always visible.
 */
export function isFieldVisible(field: BookingField, values: FieldValues): boolean {
  if (field.hidden) return false;
  if (!field.showWhen) return true;
  const current = values[field.showWhen.field];
  if (current === undefined) return false;
  const actual = Array.isArray(current) ? current : [String(current)];
  return field.showWhen.equals.some((want) => actual.includes(want));
}

/** Return only the fields that are currently visible. */
export function visibleFields(fields: BookingField[], values: FieldValues): BookingField[] {
  return fields.filter((f) => isFieldVisible(f, values));
}

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
 * Validate submitted responses against a field schema. Only visible required
 * fields are enforced; type-specific checks run on present values. Returns a
 * map of field name -> error message (empty when valid).
 */
export function validateResponses(
  fields: BookingField[],
  values: FieldValues,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    // Skip system fields – they are validated separately by the hardcoded
    // form inputs and server-side Zod schema.
    if (field.system) continue;
    if (!isFieldVisible(field, values)) continue;
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
    } else if (
      (field.type === "select" || field.type === "radio") &&
      typeof value === "string" &&
      field.options &&
      !field.options.includes(value)
    ) {
      errors[field.name] = "Choose a valid option";
    } else if (field.type === "multiselect" && Array.isArray(value) && field.options) {
      const invalid = value.filter((v) => !field.options!.includes(v));
      if (invalid.length) errors[field.name] = "Choose valid options";
    }
  }

  return errors;
}

/**
 * Strip out responses for fields that are not currently visible, so hidden
 * conditional answers are never persisted.
 */
export function pruneHiddenResponses(
  fields: BookingField[],
  values: FieldValues,
): FieldValues {
  const out: FieldValues = {};
  for (const field of fields) {
    if (field.name === "name" || field.name === "email") continue;
    if (isFieldVisible(field, values) && values[field.name] !== undefined) {
      out[field.name] = values[field.name];
    }
  }
  return out;
}
