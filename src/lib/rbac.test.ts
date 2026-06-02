import { describe, it, expect } from "vitest";
import { can, canAll, canAny, canAssignRole, compareRoles, permissionsFor } from "./rbac";

describe("can", () => {
  it("grants owner every permission", () => {
    expect(can("owner", "team.delete")).toBe(true);
    expect(can("owner", "billing.manage")).toBe(true);
    expect(can("owner", "member.role.assign")).toBe(true);
  });

  it("denies admin team.delete and billing", () => {
    expect(can("admin", "team.delete")).toBe(false);
    expect(can("admin", "billing.manage")).toBe(false);
    expect(can("admin", "member.invite")).toBe(true);
  });

  it("limits manager to people + scheduling ops", () => {
    expect(can("manager", "member.invite")).toBe(true);
    expect(can("manager", "booking.manage")).toBe(true);
    expect(can("manager", "team.manage")).toBe(false);
    expect(can("manager", "billing.manage")).toBe(false);
  });

  it("scopes provider to own config + view", () => {
    expect(can("provider", "availability.manage")).toBe(true);
    expect(can("provider", "eventType.manage")).toBe(true);
    expect(can("provider", "member.invite")).toBe(false);
    expect(can("provider", "booking.manage")).toBe(false);
  });

  it("lets receptionist manage bookings but not config", () => {
    expect(can("receptionist", "booking.manage")).toBe(true);
    expect(can("receptionist", "booking.view")).toBe(true);
    expect(can("receptionist", "availability.manage")).toBe(false);
    expect(can("receptionist", "eventType.manage")).toBe(false);
  });

  it("restricts member to read-only visibility", () => {
    expect(can("member", "team.view")).toBe(true);
    expect(can("member", "booking.view")).toBe(false);
  });
});

describe("canAll / canAny", () => {
  it("canAll requires every permission", () => {
    expect(canAll("manager", ["member.invite", "booking.manage"])).toBe(true);
    expect(canAll("manager", ["member.invite", "billing.manage"])).toBe(false);
  });

  it("canAny needs only one", () => {
    expect(canAny("provider", ["billing.manage", "availability.manage"])).toBe(true);
    expect(canAny("member", ["billing.manage", "booking.manage"])).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("lets owner assign any role", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("owner", "owner")).toBe(true);
  });

  it("lets admin assign only lower roles", () => {
    expect(canAssignRole("admin", "manager")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "owner")).toBe(false);
  });

  it("denies roles without assign permission", () => {
    expect(canAssignRole("provider", "member")).toBe(false);
    expect(canAssignRole("receptionist", "member")).toBe(false);
  });
});

describe("compareRoles / permissionsFor", () => {
  it("ranks owner above member", () => {
    expect(compareRoles("owner", "member")).toBeGreaterThan(0);
    expect(compareRoles("member", "owner")).toBeLessThan(0);
  });

  it("returns the permission list for a role", () => {
    expect(permissionsFor("member")).toEqual(["team.view"]);
    expect(permissionsFor("owner").length).toBeGreaterThan(5);
  });
});
