import { describe, it, expect } from "vitest";
import {
  isFieldVisible,
  visibleFields,
  validateResponses,
  pruneHiddenResponses,
  type FieldValues,
} from "./booking-fields";
import type { BookingField } from "@/db/schema";

const base: BookingField = { name: "x", label: "X", type: "text", required: false };

describe("isFieldVisible", () => {
  it("shows fields with no condition", () => {
    expect(isFieldVisible(base, {})).toBe(true);
  });

  it("hides a conditional field until the trigger matches", () => {
    const field: BookingField = {
      ...base,
      name: "details",
      label: "Details",
      showWhen: { field: "reason", equals: ["other"] },
    };
    expect(isFieldVisible(field, {})).toBe(false);
    expect(isFieldVisible(field, { reason: "support" })).toBe(false);
    expect(isFieldVisible(field, { reason: "other" })).toBe(true);
  });

  it("matches conditions against multiselect arrays", () => {
    const field: BookingField = {
      ...base,
      showWhen: { field: "topics", equals: ["billing"] },
    };
    expect(isFieldVisible(field, { topics: ["sales", "billing"] })).toBe(true);
    expect(isFieldVisible(field, { topics: ["sales"] })).toBe(false);
  });
});

describe("visibleFields", () => {
  it("filters out hidden fields", () => {
    const fields: BookingField[] = [
      base,
      { ...base, name: "y", showWhen: { field: "x", equals: ["go"] } },
    ];
    expect(visibleFields(fields, {}).map((f) => f.name)).toEqual(["x"]);
    expect(visibleFields(fields, { x: "go" }).map((f) => f.name)).toEqual(["x", "y"]);
  });
});

describe("validateResponses", () => {
  it("flags missing required visible fields", () => {
    const fields: BookingField[] = [{ ...base, name: "phone", label: "Phone", type: "phone", required: true }];
    expect(validateResponses(fields, {})).toEqual({ phone: "Phone is required" });
  });

  it("skips required check for hidden fields", () => {
    const fields: BookingField[] = [
      { ...base, name: "more", label: "More", required: true, showWhen: { field: "x", equals: ["yes"] } },
    ];
    expect(validateResponses(fields, {})).toEqual({});
  });

  it("validates email and phone formats", () => {
    const fields: BookingField[] = [
      { ...base, name: "email", label: "Email", type: "email", required: true },
      { ...base, name: "tel", label: "Tel", type: "phone", required: true },
    ];
    const errs = validateResponses(fields, { email: "nope", tel: "12" });
    expect(errs.email).toBe("Enter a valid email");
    expect(errs.tel).toBe("Enter a valid phone number");
  });

  it("rejects out-of-set select values", () => {
    const fields: BookingField[] = [
      { ...base, name: "size", label: "Size", type: "select", required: true, options: ["S", "M"] },
    ];
    expect(validateResponses(fields, { size: "XL" })).toEqual({ size: "Choose a valid option" });
    expect(validateResponses(fields, { size: "M" })).toEqual({});
  });

  it("accepts valid responses", () => {
    const fields: BookingField[] = [
      { ...base, name: "email", label: "Email", type: "email", required: true },
      { ...base, name: "count", label: "Count", type: "number", required: false },
    ];
    expect(validateResponses(fields, { email: "a@b.co", count: "3" })).toEqual({});
  });


});

describe("pruneHiddenResponses", () => {
  it("drops hidden field answers and system fields", () => {
    const fields: BookingField[] = [
      { ...base, name: "email", label: "Email", type: "email", required: true, system: true },
      { ...base, name: "topic", label: "Topic", type: "select", options: ["a", "b"] },
      { ...base, name: "detail", label: "Detail", showWhen: { field: "topic", equals: ["a"] } },
    ];
    const values: FieldValues = { email: "a@b.co", topic: "b", detail: "leaked" };
    expect(pruneHiddenResponses(fields, values)).toEqual({ topic: "b" });
  });


});
