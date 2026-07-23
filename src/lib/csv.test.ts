import { describe, it, expect } from "vitest";
import { parseCsvRecords, validateProviderImport } from "./csv";

describe("parseCsvRecords", () => {
  it("maps rows to objects by lowercased header", () => {
    const out = parseCsvRecords("Email,Name\na@b.co,Ann\nc@d.co,Cara");
    expect(out).toEqual([
      { email: "a@b.co", name: "Ann" },
      { email: "c@d.co", name: "Cara" },
    ]);
  });

  it("ignores blank lines", () => {
    expect(parseCsvRecords("email\n\na@b.co\n")).toEqual([{ email: "a@b.co" }]);
  });

  it("handles quoted cells, escaped quotes, embedded newlines, and CRLF", () => {
    expect(
      parseCsvRecords('name,note\r\n"Doe, John","say ""hi""\nagain"'),
    ).toEqual([{ name: "Doe, John", note: 'say "hi"\nagain' }]);
  });
});

describe("validateProviderImport", () => {
  it("accepts valid rows and defaults role/name", () => {
    const result = validateProviderImport([{ email: "A@B.CO", name: "", role: "" }]);
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual([{ email: "a@b.co", name: "a", role: "member" }]);
  });

  it("flags missing and invalid emails", () => {
    const result = validateProviderImport([{ email: "" }, { email: "nope" }]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toBe("Missing email");
    expect(result.errors[1].message).toContain("Invalid email");
  });

  it("flags duplicates and invalid roles", () => {
    const result = validateProviderImport([
      { email: "a@b.co", role: "member" },
      { email: "a@b.co", role: "member" },
      { email: "c@d.co", role: "wizard" },
    ]);
    const messages = result.errors.map((e) => e.message);
    expect(messages.some((m) => m.includes("Duplicate"))).toBe(true);
    expect(messages.some((m) => m.includes("Invalid role"))).toBe(true);
    expect(result.valid).toHaveLength(1);
  });

  it("reports correct 1-based line numbers (accounting for header)", () => {
    const result = validateProviderImport([{ email: "ok@x.co" }, { email: "bad" }]);
    expect(result.errors[0].line).toBe(3);
  });
});
