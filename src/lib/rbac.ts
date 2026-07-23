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
  | "availability.all.manage"
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
  "availability.all.manage",
  "booking.own.view",
  "booking.own.manage",
  "booking.all.view",
  "booking.all.manage",
  "customer.all.view",
  "connection.own.manage",
  "company.settings.manage",
];

const MATRIX: Record<MembershipRole, Permission[]> = {
  // Full control, including deleting/transferring the team.
  owner: ALL,
  // Manages the team, services, members, all bookings and company settings —
  // everything except deleting the team itself.
  admin: ALL.filter((permission) => permission !== "team.delete"),
  // Front-desk: sees and manages every booking and customer, but is not a
  // bookable provider and cannot view/manage the service catalogue, team,
  // members or settings. They still book on behalf of customers from the
  // calendar (quick-create loads services via booking.all.manage).
  scheduler: [
    "team.directory.view",
    "booking.all.view",
    "booking.all.manage",
    "customer.all.view",
  ],
  // A regular team member / provider: takes appointments and manages their own
  // availability, own bookings and own integrations.
  member: [
    "team.directory.view",
    "service.assigned.view",
    "availability.own.manage",
    "booking.own.view",
    "booking.own.manage",
    "connection.own.manage",
  ],
};

export function can(role: MembershipRole, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function canAny(role: MembershipRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

const RANK: Record<MembershipRole, number> = {
  owner: 4,
  admin: 3,
  scheduler: 2,
  member: 1,
};

export function canAssignRole(actor: MembershipRole, target: MembershipRole): boolean {
  if (!can(actor, "member.role.assign")) return false;
  if (actor === "owner") return true;
  return RANK[target] < RANK[actor];
}

/**
 * Whether a role grants instance-administration (company settings, SMTP/M365
 * email, custom domain, webhooks). These surfaces are gated by the
 * `users.isAdmin` flag rather than a per-request role lookup; that flag is kept
 * in sync with this predicate at every role-assignment site, so
 * `company.settings.manage` (held by owner + admin) is enforced through it.
 */
export function isAdminRole(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}
