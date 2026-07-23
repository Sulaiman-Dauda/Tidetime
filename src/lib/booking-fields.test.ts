import { describe, it, expect } from "vitest";
import {
  validateResponses,
} from "./booking-fields";
import type { BookingField } from "@/db/schema";

const base: BookingField = { name: "x", label: "X", type: "text", required: false };

describe("validateResponses", () => {
  it("flags missing required visible fields", () => {
    const fields: BookingField[] = [{ ...base, name: "phone", label: "Phone", type: "phone", required: true }];
    expect(validateResponses(fields, {})).toEqual({ phone: "Phone is required" });
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

  it("accepts valid responses", () => {
    const fields: BookingField[] = [
      { ...base, name: "email", label: "Email", type: "email", required: true },
      { ...base, name: "count", label: "Count", type: "number", required: false },
    ];
    expect(validateResponses(fields, { email: "a@b.co", count: "3" })).toEqual({});
  });
});
