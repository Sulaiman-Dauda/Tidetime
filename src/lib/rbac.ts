import type { MembershipRole } from "@/db/schema";

/**
 * Discrete permissions used to gate team/organization actions. Kept coarse on
 * purpose — this is role-based access control, not a full policy engine.
 */
export type Permission =
  | "team.view"
  | "team.manage" // rename, branding, capacity rules
  | "team.delete"
  | "member.invite"
  | "member.remove"
  | "member.role.assign"
  | "service.manage" // create/edit team services
  | "availability.manage" // edit shared/provider availability
  | "booking.view" // see team bookings
  | "booking.manage" // create/reschedule/cancel on behalf of others
  | "billing.manage"
  | "analytics.view";

const ALL: Permission[] = [
  "team.view",
  "team.manage",
  "team.delete",
  "member.invite",
  "member.remove",
  "member.role.assign",
  "service.manage",
  "availability.manage",
  "booking.view",
  "booking.manage",
  "billing.manage",
  "analytics.view",
];

/**
 * Permission matrix per role.
 * - owner: everything
 * - admin: everything except deleting the team and billing
 * - manager: people + scheduling operations, no structural/billing changes
 * - provider: manage their own availability + services, view their bookings
 * - receptionist: front-desk — view and manage bookings, no config changes
 * - member: read-only team visibility
 */
const MATRIX: Record<MembershipRole, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== "team.delete" && p !== "billing.manage"),
  manager: [
    "team.view",
    "member.invite",
    "member.remove",
    "service.manage",
    "availability.manage",
    "booking.view",
    "booking.manage",
    "analytics.view",
  ],
  provider: ["team.view", "service.manage", "availability.manage", "booking.view"],
  receptionist: ["team.view", "booking.view", "booking.manage"],
  member: ["team.view"],
};

/** Whether a role grants a permission. */
export function can(role: MembershipRole, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

/** Whether a role grants every permission in the list. */
export function canAll(role: MembershipRole, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/** Whether a role grants at least one of the permissions. */
export function canAny(role: MembershipRole, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** All permissions a role holds. */
export function permissionsFor(role: MembershipRole): Permission[] {
  return MATRIX[role] ?? [];
}

const RANK: Record<MembershipRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  provider: 2,
  receptionist: 2,
  member: 1,
};

/**
 * Whether `actor` may assign `target` role to someone. A user can only grant
 * roles strictly below their own rank (owners may grant any role including
 * admin, but not another owner unless they are owner themselves).
 */
export function canAssignRole(actor: MembershipRole, target: MembershipRole): boolean {
  if (!can(actor, "member.role.assign")) return false;
  if (actor === "owner") return true;
  return RANK[target] < RANK[actor];
}

/** Compare two roles by privilege rank (positive when a outranks b). */
export function compareRoles(a: MembershipRole, b: MembershipRole): number {
  return RANK[a] - RANK[b];
}
