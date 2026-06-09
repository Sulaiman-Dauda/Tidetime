import { describe, expect, it } from "vitest";
import { evaluateRouting, matchCondition, matchRoute, validateRoutingAnswers } from "./routing";
import type { RoutingField, RoutingRoute } from "@/db/schema";

describe("matchCondition", () => {
  const answers = { team: "Sales", size: "500" };
  it("equals / not_equals (case-insensitive, trimmed)", () => {
    expect(matchCondition({ fieldId: "team", operator: "equals", value: "sales" }, answers)).toBe(true);
    expect(matchCondition({ fieldId: "team", operator: "not_equals", value: "support" }, answers)).toBe(true);
  });
  it("contains", () => {
    expect(matchCondition({ fieldId: "team", operator: "contains", value: "ale" }, answers)).toBe(true);
  });
  it("is_any_of", () => {
    expect(
      matchCondition({ fieldId: "team", operator: "is_any_of", value: "sales, marketing" }, answers),
    ).toBe(true);
    expect(
      matchCondition({ fieldId: "team", operator: "is_any_of", value: "support, ops" }, answers),
    ).toBe(false);
  });
  it("missing answer never matches equals", () => {
    expect(matchCondition({ fieldId: "nope", operator: "equals", value: "x" }, answers)).toBe(false);
  });
});

describe("matchRoute / evaluateRouting", () => {
  const routes: RoutingRoute[] = [
    {
      id: "r1",
      conditions: [
        { fieldId: "team", operator: "equals", value: "sales" },
        { fieldId: "size", operator: "equals", value: "500" },
      ],
      action: { type: "event_type", eventTypeId: 10 },
    },
    {
      id: "r2",
      conditions: [{ fieldId: "team", operator: "equals", value: "support" }],
      action: { type: "external_url", url: "https://help.example" },
    },
  ];
  const fallback = { type: "message" as const, message: "We'll be in touch" };

  it("requires all conditions in a route (AND)", () => {
    expect(matchRoute(routes[0], { team: "sales", size: "500" })).toBe(true);
    expect(matchRoute(routes[0], { team: "sales", size: "1" })).toBe(false);
  });

  it("returns the first matching route's action", () => {
    expect(evaluateRouting(routes, fallback, { team: "sales", size: "500" })).toEqual({
      type: "event_type",
      eventTypeId: 10,
    });
    expect(evaluateRouting(routes, fallback, { team: "support" })).toEqual({
      type: "external_url",
      url: "https://help.example",
    });
  });

  it("falls back when nothing matches", () => {
    expect(evaluateRouting(routes, fallback, { team: "ops" })).toEqual(fallback);
  });

  it("returns null when no match and no fallback", () => {
    expect(evaluateRouting(routes, null, { team: "ops" })).toBeNull();
  });
});

describe("validateRoutingAnswers", () => {
  const fields: RoutingField[] = [
    { id: "name", label: "Name", type: "short_text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
    { id: "count", label: "Count", type: "number", required: false },
  ];
  it("flags missing required fields", () => {
    expect(validateRoutingAnswers(fields, { email: "a@b.co" })).toHaveProperty("name");
  });
  it("validates email + number formats", () => {
    expect(validateRoutingAnswers(fields, { name: "x", email: "bad", count: "nope" })).toEqual({
      email: "Enter a valid email",
      count: "Enter a number",
    });
  });
  it("passes valid input", () => {
    expect(validateRoutingAnswers(fields, { name: "x", email: "a@b.co", count: "3" })).toEqual({});
  });
});
