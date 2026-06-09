import type { CustomerFieldDef } from "@/db/schema";

/**
 * Custom customer fields (stolen from EasyAppointments, but schema-defined rather
 * than five fixed columns). Definitions live in app_settings; each customer's
 * answers live in customers.customFields keyed by field id. These helpers are
 * pure so they can be unit-tested and reused on both the server and the client.
 */

export const MAX_CUSTOMER_FIELDS = 12;

const FIELD_TYPES: CustomerFieldDef["type"][] = ["text", "textarea", "number", "phone", "select"];

/** Field ids are stable keys — lowercase, safe for JSON + form names. */
export function isValidFieldId(id: string): boolean {
  return /^[a-z][a-z0-9_]{0,31}$/.test(id);
}

/** Coerce arbitrary stored JSON into a clean, capped list of field definitions. */
export function normalizeFieldDefs(raw: unknown): CustomerFieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerFieldDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const type = r.type as CustomerFieldDef["type"];
    if (!isValidFieldId(id) || seen.has(id) || !label || !FIELD_TYPES.includes(type)) continue;
    seen.add(id);
    const def: CustomerFieldDef = { id, label, type, required: r.required === true };
    if (type === "select") {
      const opts = Array.isArray(r.options)
        ? r.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
        : [];
      if (opts.length === 0) continue; // a select with no options is meaningless
      def.options = opts;
    }
    out.push(def);
    if (out.length >= MAX_CUSTOMER_FIELDS) break;
  }
  return out;
}

export interface FieldValueResult {
  ok: boolean;
  /** cleaned values keyed by field id (only known fields kept) */
  values: Record<string, string>;
  /** per-field-id error messages */
  errors: Record<string, string>;
}

/**
 * Validate + clean a set of custom-field answers against the current definitions.
 * Unknown keys are dropped; required fields must be present; selects must match an
 * option; numbers must parse. Never throws.
 */
export function validateCustomerFieldValues(
  defs: CustomerFieldDef[],
  input: Record<string, unknown>,
): FieldValueResult {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const def of defs) {
    const raw = input[def.id];
    const str = raw == null ? "" : String(raw).trim();
    if (!str) {
      if (def.required) errors[def.id] = `${def.label} is required`;
      continue;
    }
    if (def.type === "number" && Number.isNaN(Number(str))) {
      errors[def.id] = `${def.label} must be a number`;
      continue;
    }
    if (def.type === "select" && def.options && !def.options.includes(str)) {
      errors[def.id] = `${def.label} has an invalid choice`;
      continue;
    }
    values[def.id] = str.slice(0, 2000);
  }
  return { ok: Object.keys(errors).length === 0, values, errors };
}
