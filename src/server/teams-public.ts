import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  teams,
  services,
  serviceProviders,
  users,
  type Team,
} from "@/db/schema";
import { getSlots, type ResolvedService } from "@/server/availability";
import { groupSlotsByDay, type Slot } from "@/lib/slots";
import { mergeTeamSlots, type HostSlots, type TeamSlot } from "@/lib/team-availability";

export interface TeamServiceView {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  length: number;
  nextAvailable: string | null;
}

/** Resolve a team by its public slug. */
export async function getPublicTeam(slug: string): Promise<Team | null> {
  const [team] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
  return team ?? null;
}

/** List a team's visible services for its public landing page. */
export async function getTeamServices(teamId: number): Promise<TeamServiceView[]> {
  const rows = await db
    .select()
    .from(services)
    .where(and(eq(services.teamId, teamId), eq(services.hidden, false), eq(services.draft, false)))
    .orderBy(asc(services.position), asc(services.id));

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const nextById = new Map(
    await Promise.all(
      rows.map(async (service) => {
        const resolved: ResolvedService = {
          ...service,
          providerId: null,
          providerScheduleId: null,
          hostTimeZone: "UTC",
          scheduleTimeZone: "UTC",
        };
        const next = await getTeamSlots({
          service: resolved,
          rangeStart: now,
          rangeEnd,
        });
        return [service.id, next[0]?.time ?? null] as const;
      }),
    ),
  );

  return rows.map((service) => ({
    id: service.id,
    slug: service.slug,
    title: service.title,
    description: service.description,
    length: service.length,
    nextAvailable: nextById.get(service.id) ?? null,
  }));
}

/** Load a single company service by company slug + service slug. */
export async function getTeamService(
  teamSlug: string,
  serviceSlug: string,
): Promise<{ team: Team; service: ResolvedService } | null> {
  const team = await getPublicTeam(teamSlug);
  if (!team) return null;

  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.teamId, team.id), eq(services.slug, serviceSlug), eq(services.draft, false)))
    .limit(1);
  if (!row || row.hidden) return null;

  return {
    team,
    service: {
      ...row,
      providerId: null,
      providerScheduleId: null,
      hostTimeZone: "UTC",
      scheduleTimeZone: "UTC",
    },
  };
}

/** Host user ids attached to a team service. */
async function loadHostUserIds(serviceId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: serviceProviders.userId })
    .from(serviceProviders)
    .where(eq(serviceProviders.serviceId, serviceId));
  return rows.map((r) => r.userId);
}

export interface TeamHost {
  id: number;
  name: string | null;
  username: string;
  avatarUrl: string | null;
}

/**
 * Public host roster for a team service, used to let bookers pick a specific
 * provider (or keep "any available").
 */
export async function getTeamHosts(serviceId: number): Promise<TeamHost[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(serviceProviders)
    .innerJoin(users, eq(serviceProviders.userId, users.id))
    .where(eq(serviceProviders.serviceId, serviceId));
}

/**
 * Compute merged team availability for a team service over a window.
 * Each host's slots are computed individually (respecting their own schedule
 * and bookings) then merged by the service's scheduling type.
 */
export async function getTeamSlots(args: {
  service: ResolvedService;
  rangeStart: Date;
  rangeEnd: Date;
  duration?: number;
  now?: Date;
  /** restrict to a single chosen host (booker picked a specific provider) */
  preferredHostId?: number;
}): Promise<TeamSlot[]> {
  let hostIds = await loadHostUserIds(args.service.id);
  if (args.preferredHostId && hostIds.includes(args.preferredHostId)) {
    hostIds = [args.preferredHostId];
  }
  if (hostIds.length === 0) return [];

  // Resolve each host's default schedule timezone for accurate computation.
  const hostUsers = await db
    .select({ id: users.id, tz: users.timeZone, defaultScheduleId: users.defaultScheduleId })
    .from(users)
    .where(inArray(users.id, hostIds));

  const perHost: HostSlots[] = [];
  for (const host of hostUsers) {
    const hostService: ResolvedService = {
      ...args.service,
      providerId: host.id,
      providerScheduleId: host.defaultScheduleId,
      hostTimeZone: host.tz,
      scheduleTimeZone: host.tz,
    };
    const slots: Slot[] = await getSlots({
      service: hostService,
      rangeStart: args.rangeStart,
      rangeEnd: args.rangeEnd,
      duration: args.duration,
      now: args.now,
    });
    perHost.push({ hostId: host.id, slots });
  }

  return mergeTeamSlots(perHost);
}

/** Group team slots by day for the viewer's timezone. */
export function groupTeamSlotsByDay(slots: TeamSlot[], viewerTz: string): Record<string, TeamSlot[]> {
  const asSlots: Slot[] = slots.map((s) => ({ time: s.time, seatsRemaining: s.seatsRemaining }));
  const grouped = groupSlotsByDay(asSlots, viewerTz);
  const byTime = new Map(slots.map((s) => [s.time, s]));
  const out: Record<string, TeamSlot[]> = {};
  for (const [day, daySlots] of Object.entries(grouped)) {
    out[day] = daySlots.map((s) => byTime.get(s.time) ?? { time: s.time, hostIds: [], seatsRemaining: s.seatsRemaining });
  }
  return out;
}
