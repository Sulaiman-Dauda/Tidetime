import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  teams,
  eventTypes,
  eventTypeHosts,
  users,
  schedules,
  type Team,
} from "@/db/schema";
import { getSlots, type ResolvedEventType } from "@/server/availability";
import { groupSlotsByDay, type Slot } from "@/lib/slots";
import { mergeTeamSlots, type HostSlots, type TeamSlot } from "@/lib/team-availability";

export interface TeamEventView {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  length: number;
  schedulingType: string | null;
  scheduleTimeZone: string;
  nextAvailable: string | null;
}

/** Resolve a team by its public slug. */
export async function getPublicTeam(slug: string): Promise<Team | null> {
  const [team] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
  return team ?? null;
}

/** List a team's visible services for its public landing page. */
export async function getTeamEventTypes(teamId: number): Promise<TeamEventView[]> {
  const rows = await db
    .select({ et: eventTypes, scheduleTz: schedules.timeZone })
    .from(eventTypes)
    .leftJoin(schedules, eq(eventTypes.scheduleId, schedules.id))
    .where(and(eq(eventTypes.teamId, teamId), eq(eventTypes.hidden, false), eq(eventTypes.draft, false)))
    .orderBy(asc(eventTypes.position), asc(eventTypes.id));

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const nextById = new Map(
    await Promise.all(
      rows.map(async ({ et, scheduleTz }) => {
        const resolved: ResolvedEventType = {
          ...et,
          hostTimeZone: scheduleTz ?? "UTC",
          scheduleTimeZone: scheduleTz ?? "UTC",
        };
        const next = await getTeamSlots({
          eventType: resolved,
          rangeStart: now,
          rangeEnd,
        });
        return [et.id, next[0]?.time ?? null] as const;
      }),
    ),
  );

  return rows.map(({ et, scheduleTz }) => ({
    id: et.id,
    slug: et.slug,
    title: et.title,
    description: et.description,
    length: et.length,
    schedulingType: et.schedulingType,
    scheduleTimeZone: scheduleTz ?? "UTC",
    nextAvailable: nextById.get(et.id) ?? null,
  }));
}

/** Load a single team service by team slug + event slug. */
export async function getTeamEventType(
  teamSlug: string,
  eventSlug: string,
): Promise<{ team: Team; eventType: ResolvedEventType } | null> {
  const team = await getPublicTeam(teamSlug);
  if (!team) return null;

  const [row] = await db
    .select({ et: eventTypes, scheduleTz: schedules.timeZone })
    .from(eventTypes)
    .leftJoin(schedules, eq(eventTypes.scheduleId, schedules.id))
    .where(and(eq(eventTypes.teamId, team.id), eq(eventTypes.slug, eventSlug), eq(eventTypes.draft, false)))
    .limit(1);
  if (!row || row.et.hidden) return null;

  return {
    team,
    eventType: {
      ...row.et,
      hostTimeZone: row.scheduleTz ?? "UTC",
      scheduleTimeZone: row.scheduleTz ?? "UTC",
    },
  };
}

/** Host user ids attached to a team service. */
async function loadHostUserIds(eventTypeId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: eventTypeHosts.userId })
    .from(eventTypeHosts)
    .where(eq(eventTypeHosts.eventTypeId, eventTypeId));
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
 * provider (or keep "any available"). Only meaningful for round_robin/managed.
 */
export async function getTeamHosts(eventTypeId: number): Promise<TeamHost[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(eventTypeHosts)
    .innerJoin(users, eq(eventTypeHosts.userId, users.id))
    .where(eq(eventTypeHosts.eventTypeId, eventTypeId));
}

/**
 * Compute merged team availability for a team service over a window.
 * Each host's slots are computed individually (respecting their own schedule
 * and bookings) then merged by the service's scheduling type.
 */
export async function getTeamSlots(args: {
  eventType: ResolvedEventType;
  rangeStart: Date;
  rangeEnd: Date;
  duration?: number;
  now?: Date;
  /** restrict to a single chosen host (booker picked a specific provider) */
  preferredHostId?: number;
}): Promise<TeamSlot[]> {
  let hostIds = await loadHostUserIds(args.eventType.id);
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
    const hostEventType: ResolvedEventType = {
      ...args.eventType,
      userId: host.id,
      scheduleId: host.defaultScheduleId ?? args.eventType.scheduleId,
      hostTimeZone: host.tz,
      scheduleTimeZone: host.tz,
    };
    const slots: Slot[] = await getSlots({
      eventType: hostEventType,
      rangeStart: args.rangeStart,
      rangeEnd: args.rangeEnd,
      duration: args.duration,
      now: args.now,
    });
    perHost.push({ hostId: host.id, slots });
  }

  return mergeTeamSlots(
    args.eventType.schedulingType ?? "round_robin",
    perHost,
    args.eventType.requiredHosts ?? 1,
  );
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
