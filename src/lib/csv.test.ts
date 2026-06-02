import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvRecords, toCsv, validateProviderImport } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas and newlines", () => {
    expect(parseCsv('name,note\n"Doe, John","line1\nline2"')).toEqual([
      ["name", "note"],
      ["Doe, John", "line1\nline2"],
    ]);
  });

  it("handles escaped quotes", () => {
    expect(parseCsv('a\n"say ""hi"""')).toEqual([["a"], ['say "hi"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

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
});

describe("toCsv", () => {
  it("serializes with column order and escaping", () => {
    const csv = toCsv([{ name: "Doe, John", email: "j@x.co" }], ["email", "name"]);
    expect(csv).toBe('email,name\nj@x.co,"Doe, John"');
  });

  it("renders missing values as empty", () => {
    expect(toCsv([{ a: "1" }], ["a", "b"])).toBe("a,b\n1,");
  });
});

describe("validateProviderImport", () => {
  it("accepts valid rows and defaults role/name", () => {
    const result = validateProviderImport([{ email: "A@B.CO", name: "", role: "" }]);
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual([{ email: "a@b.co", name: "a", role: "provider" }]);
  });

  it("flags missing and invalid emails", () => {
    const result = validateProviderImport([{ email: "" }, { email: "nope" }]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toBe("Missing email");
    expect(result.errors[1].message).toContain("Invalid email");
  });

  it("flags duplicates and invalid roles", () => {
    const result = validateProviderImport([
      { email: "a@b.co", role: "provider" },
      { email: "a@b.co", role: "provider" },
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
