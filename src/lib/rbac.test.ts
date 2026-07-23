import { describe, expect, it } from "vitest";
import { can, canAll, canAny, canAssignRole, compareRoles, permissionsFor } from "./rbac";

describe("role permissions", () => {
  it("gives owners every company and personal permission", () => {
    expect(can("owner", "team.delete")).toBe(true);
    expect(can("owner", "service.catalog.manage")).toBe(true);
    expect(can("owner", "booking.all.manage")).toBe(true);
    expect(can("owner", "company.settings.manage")).toBe(true);
  });

  it("keeps admins from deleting the company", () => {
    expect(can("admin", "team.delete")).toBe(false);
    expect(can("admin", "member.role.assign")).toBe(true);
    expect(can("admin", "service.catalog.manage")).toBe(true);
  });

  it("allows managers to operate the catalogue and company bookings", () => {
    expect(can("manager", "service.catalog.manage")).toBe(true);
    expect(can("manager", "booking.all.manage")).toBe(true);
    expect(can("manager", "customer.all.view")).toBe(true);
    expect(can("manager", "company.settings.manage")).toBe(false);
  });

  it("limits providers to their own operational scope", () => {
    expect(can("provider", "service.assigned.view")).toBe(true);
    expect(can("provider", "availability.own.manage")).toBe(true);
    expect(can("provider", "booking.own.manage")).toBe(true);
    expect(can("provider", "connection.own.manage")).toBe(true);
    expect(can("provider", "service.catalog.manage")).toBe(false);
    expect(can("provider", "booking.all.view")).toBe(false);
    expect(can("provider", "customer.all.view")).toBe(false);
    expect(can("provider", "member.invite")).toBe(false);
  });

  it("gives receptionists front-desk access without provider configuration", () => {
    expect(can("receptionist", "booking.all.manage")).toBe(true);
    expect(can("receptionist", "customer.all.view")).toBe(true);
    expect(can("receptionist", "availability.own.manage")).toBe(false);
    expect(can("receptionist", "service.catalog.manage")).toBe(false);
  });

  it("keeps members to the teammate directory", () => {
    expect(permissionsFor("member")).toEqual(["team.directory.view"]);
  });

  it("supports all/any checks", () => {
    expect(
      canAll("provider", ["booking.own.view", "availability.own.manage"]),
    ).toBe(true);
    expect(
      canAny("provider", ["customer.all.view", "service.assigned.view"]),
    ).toBe(true);
  });
});

describe("role assignment", () => {
  it("allows owners to assign every role", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("owner", "owner")).toBe(true);
  });

  it("allows admins to assign lower roles only", () => {
    expect(canAssignRole("admin", "manager")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "owner")).toBe(false);
  });

  it("does not let operational roles assign roles", () => {
    expect(canAssignRole("manager", "provider")).toBe(false);
    expect(canAssignRole("provider", "member")).toBe(false);
  });

  it("compares privilege rank", () => {
    expect(compareRoles("owner", "admin")).toBeGreaterThan(0);
    expect(compareRoles("provider", "receptionist")).toBe(0);
  });
});
