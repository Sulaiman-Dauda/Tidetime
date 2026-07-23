import { describe, expect, it } from "vitest";
import { can, canAny, canAssignRole } from "./rbac";

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

  it("gives schedulers front-desk access without provider configuration", () => {
    expect(can("scheduler", "booking.all.manage")).toBe(true);
    expect(can("scheduler", "customer.all.view")).toBe(true);
    expect(can("scheduler", "availability.own.manage")).toBe(false);
    expect(can("scheduler", "service.catalog.view")).toBe(false);
    expect(can("scheduler", "service.catalog.manage")).toBe(false);
    expect(can("scheduler", "member.invite")).toBe(false);
  });

  it("limits members to their own operational scope", () => {
    expect(can("member", "team.directory.view")).toBe(true);
    expect(can("member", "service.assigned.view")).toBe(true);
    expect(can("member", "availability.own.manage")).toBe(true);
    expect(can("member", "booking.own.manage")).toBe(true);
    expect(can("member", "connection.own.manage")).toBe(true);
    expect(can("member", "service.catalog.manage")).toBe(false);
    expect(can("member", "booking.all.view")).toBe(false);
    expect(can("member", "customer.all.view")).toBe(false);
    expect(can("member", "member.invite")).toBe(false);
  });

  it("supports any-permission checks", () => {
    expect(
      canAny("member", ["customer.all.view", "service.assigned.view"]),
    ).toBe(true);
  });
});

describe("role assignment", () => {
  it("allows owners to assign every role", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("owner", "owner")).toBe(true);
  });

  it("allows admins to assign lower roles only", () => {
    expect(canAssignRole("admin", "scheduler")).toBe(true);
    expect(canAssignRole("admin", "member")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "owner")).toBe(false);
  });

  it("does not let operational roles assign roles", () => {
    expect(canAssignRole("scheduler", "member")).toBe(false);
    expect(canAssignRole("member", "member")).toBe(false);
  });
});
