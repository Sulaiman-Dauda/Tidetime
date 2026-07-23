/**
 * Minimal, dependency-free CSV utilities for bulk operations (e.g. importing
 * providers/customers). Supports quoted fields, escaped quotes ("") and commas
 * inside quotes. Not a full RFC-4180 implementation, but robust for typical
 * spreadsheet exports.
 */

/** Parse a CSV string into rows of string cells. */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      // handle CRLF: skip the \n after \r
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  // flush trailing cell/row if any content remains
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse CSV with a header row into objects keyed by (normalized) header names.
 * Empty trailing lines are ignored.
 */
export function parseCsvRecords(input: string): Record<string, string>[] {
  const rows = parseCsv(input).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (cells[i] ?? "").trim();
    });
    return record;
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ProviderImportRow {
  email: string;
  name: string;
  role: string;
}

export interface ImportResult {
  valid: ProviderImportRow[];
  errors: { line: number; message: string }[];
}

const VALID_ROLES = new Set([
  "owner",
  "admin",
  "scheduler",
  "member",
]);

/**
 * Validate provider import records (from parseCsvRecords). Requires an `email`
 * column; `name` and `role` are optional (role defaults to "member").
 */
export function validateProviderImport(records: Record<string, string>[]): ImportResult {
  const valid: ProviderImportRow[] = [];
  const errors: { line: number; message: string }[] = [];
  const seen = new Set<string>();

  records.forEach((record, idx) => {
    const line = idx + 2; // +1 header, +1 to 1-based
    const email = (record.email ?? "").toLowerCase();
    if (!email) {
      errors.push({ line, message: "Missing email" });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ line, message: `Invalid email: ${email}` });
      return;
    }
    if (seen.has(email)) {
      errors.push({ line, message: `Duplicate email: ${email}` });
      return;
    }
    const role = (record.role || "member").toLowerCase();
    if (!VALID_ROLES.has(role)) {
      errors.push({ line, message: `Invalid role: ${role}` });
      return;
    }
    seen.add(email);
    valid.push({ email, name: record.name || email.split("@")[0], role });
  });

  return { valid, errors };
}
