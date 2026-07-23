import type { MembershipRole } from "@/db/schema";

/**
 * Role permissions are deliberately scoped by ownership. UI visibility is only
 * a convenience; every query and mutation must enforce the same scope.
 */
export type Permission =
  | "team.directory.view"
  | "team.manage"
  | "team.delete"
  | "member.invite"
  | "member.remove"
  | "member.role.assign"
  | "service.catalog.view"
  | "service.catalog.manage"
  | "service.assigned.view"
  | "availability.own.manage"
  | "booking.own.view"
  | "booking.own.manage"
  | "booking.all.view"
  | "booking.all.manage"
  | "customer.all.view"
  | "connection.own.manage"
  | "company.settings.manage";

const ALL: Permission[] = [
  "team.directory.view",
  "team.manage",
  "team.delete",
  "member.invite",
  "member.remove",
  "member.role.assign",
  "service.catalog.view",
  "service.catalog.manage",
  "service.assigned.view",
  "availability.own.manage",
  "booking.own.view",
  "booking.own.manage",
  "booking.all.view",
  "booking.all.manage",
  "customer.all.view",
  "connection.own.manage",
  "company.settings.manage",
];

const MATRIX: Record<MembershipRole, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((permission) => permission !== "team.delete"),
  manager: [
    "team.directory.view",
    "member.invite",
    "member.remove",
    "service.catalog.view",
    "service.catalog.manage",
    "service.assigned.view",
    "availability.own.manage",
    "booking.own.view",
    "booking.own.manage",
    "booking.all.view",
    "booking.all.manage",
    "customer.all.view",
    "connection.own.manage",
  ],
  provider: [
    "team.directory.view",
    "service.assigned.view",
    "availability.own.manage",
    "booking.own.view",
    "booking.own.manage",
    "connection.own.manage",
  ],
  receptionist: [
    "team.directory.view",
    "service.catalog.view",
    "booking.all.view",
    "booking.all.manage",
    "customer.all.view",
  ],
  member: ["team.directory.view"],
};

export function can(role: MembershipRole, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function canAny(role: MembershipRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

const RANK: Record<MembershipRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  provider: 2,
  receptionist: 2,
  member: 1,
};

export function canAssignRole(actor: MembershipRole, target: MembershipRole): boolean {
  if (!can(actor, "member.role.assign")) return false;
  if (actor === "owner") return true;
  return RANK[target] < RANK[actor];
}
