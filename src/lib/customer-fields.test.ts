import { describe, it, expect } from "vitest";
import {
  isValidFieldId,
  normalizeFieldDefs,
  validateCustomerFieldValues,
  MAX_CUSTOMER_FIELDS,
} from "./customer-fields";
import type { CustomerFieldDef } from "@/db/schema";

describe("isValidFieldId", () => {
  it("accepts safe ids and rejects junk", () => {
    expect(isValidFieldId("company")).toBe(true);
    expect(isValidFieldId("vat_id")).toBe(true);
    expect(isValidFieldId("1bad")).toBe(false);
    expect(isValidFieldId("Bad")).toBe(false);
    expect(isValidFieldId("has space")).toBe(false);
    expect(isValidFieldId("")).toBe(false);
  });
});

describe("normalizeFieldDefs", () => {
  it("keeps valid fields, drops duplicates + invalid", () => {
    const defs = normalizeFieldDefs([
      { id: "company", label: "Company", type: "text", required: true },
      { id: "company", label: "Dup", type: "text" }, // duplicate id
      { id: "tier", label: "Tier", type: "select", options: ["A", "B"] },
      { id: "empty_select", label: "X", type: "select", options: [] }, // no options
      { id: "Bad", label: "Bad", type: "text" }, // invalid id
      { label: "No id", type: "text" },
    ]);
    expect(defs.map((d) => d.id)).toEqual(["company", "tier"]);
    expect(defs[1].options).toEqual(["A", "B"]);
  });

  it("caps the number of fields", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `f${i}`, label: `F${i}`, type: "text" }));
    expect(normalizeFieldDefs(many)).toHaveLength(MAX_CUSTOMER_FIELDS);
  });

  it("returns [] for non-arrays", () => {
    expect(normalizeFieldDefs(null)).toEqual([]);
    expect(normalizeFieldDefs("nope")).toEqual([]);
  });
});

describe("validateCustomerFieldValues", () => {
  const defs: CustomerFieldDef[] = [
    { id: "company", label: "Company", type: "text", required: true },
    { id: "headcount", label: "Headcount", type: "number", required: false },
    { id: "tier", label: "Tier", type: "select", required: false, options: ["A", "B"] },
  ];

  it("requires required fields", () => {
    const r = validateCustomerFieldValues(defs, {});
    expect(r.ok).toBe(false);
    expect(r.errors.company).toMatch(/required/);
  });

  it("validates number + select, drops unknown keys", () => {
    const r = validateCustomerFieldValues(defs, {
      company: "Acme",
      headcount: "abc",
      tier: "Z",
      junk: "x",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.headcount).toBeTruthy();
    expect(r.errors.tier).toBeTruthy();
    expect(r.values).not.toHaveProperty("junk");
    expect(r.values.company).toBe("Acme");
  });

  it("passes a clean payload", () => {
    const r = validateCustomerFieldValues(defs, { company: "Acme", headcount: "12", tier: "A" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ company: "Acme", headcount: "12", tier: "A" });
  });
});
