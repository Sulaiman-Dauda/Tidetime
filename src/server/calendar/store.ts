import "server-only";
import { and, eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { credentials, selectedCalendars, destinationCalendars } from "@/db/schema";
import { hmacSign } from "@/lib/crypto";
import { env } from "@/lib/env";
import { invalidateCalendarCache } from "./cache";
import type { CalendarIntegration } from "./types";

/* -------------------------------------------------------------------------- */
/*  Selected calendars (busy-time sources)                                     */
/* -------------------------------------------------------------------------- */

export async function getSelectedCalendarIds(
  userId: number,
  integration: CalendarIntegration,
): Promise<string[]> {
  const rows = await db
    .select({ externalId: selectedCalendars.externalId })
    .from(selectedCalendars)
    .where(
      and(eq(selectedCalendars.userId, userId), eq(selectedCalendars.integration, integration)),
    );
  return rows.map((r) => r.externalId);
}

export async function setSelectedCalendarIds(
  userId: number,
  integration: CalendarIntegration,
  calendarIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(selectedCalendars)
      .where(
        and(eq(selectedCalendars.userId, userId), eq(selectedCalendars.integration, integration)),
      );
    if (calendarIds.length > 0) {
      await tx
        .insert(selectedCalendars)
        .values(calendarIds.map((externalId) => ({ userId, integration, externalId })));
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Destination calendar (where new booking events are written)                */
/* -------------------------------------------------------------------------- */

export async function getDestinationCalendarId(
  userId: number,
  integration: CalendarIntegration,
): Promise<string | null> {
  const [row] = await db
    .select({ externalId: destinationCalendars.externalId })
    .from(destinationCalendars)
    .where(
      and(
        eq(destinationCalendars.userId, userId),
        eq(destinationCalendars.integration, integration),
      ),
    )
    .limit(1);
  return row?.externalId ?? null;
}

export async function setDestinationCalendarId(
  userId: number,
  integration: CalendarIntegration,
  calendarId: string | null,
): Promise<void> {
  await db
    .delete(destinationCalendars)
    .where(
      and(
        eq(destinationCalendars.userId, userId),
        eq(destinationCalendars.integration, integration),
      ),
    );
  if (!calendarId) return;
  await db.insert(destinationCalendars).values({ userId, integration, externalId: calendarId });
}

/* -------------------------------------------------------------------------- */
/*  Credential helpers                                                          */
/* -------------------------------------------------------------------------- */

export async function deleteIntegration(
  userId: number,
  integration: CalendarIntegration,
): Promise<void> {
  await db
    .delete(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.type, integration)));
  await db
    .delete(selectedCalendars)
    .where(
      and(eq(selectedCalendars.userId, userId), eq(selectedCalendars.integration, integration)),
    );
  await db
    .delete(destinationCalendars)
    .where(
      and(
        eq(destinationCalendars.userId, userId),
        eq(destinationCalendars.integration, integration),
      ),
    );
  await invalidateCalendarCache(userId).catch(() => undefined);
}

export async function hasCredential(
  userId: number,
  integration: CalendarIntegration,
): Promise<boolean> {
  if (!userId) return false;
  const [cred] = await db
    .select({ id: credentials.id })
    .from(credentials)
    .where(
      and(
        eq(credentials.userId, userId),
        eq(credentials.type, integration),
        eq(credentials.invalid, false),
      ),
    )
    .limit(1);
  return Boolean(cred);
}

/* -------------------------------------------------------------------------- */
/*  Signed OAuth state (CSRF-safe, carries the user id through the redirect)    */
/* -------------------------------------------------------------------------- */

export function signOAuthState(provider: string, userId: number, issuedAt = Date.now()): string {
  const payload = `${provider}:${userId}:${issuedAt}`;
  return `${payload}:${hmacSign(payload, env.authSecret)}`;
}

export function parseOAuthState(provider: string, state: string): number | null {
  const [providerRaw, userIdRaw, issuedAtRaw, sig] = state.split(":");
  if (providerRaw !== provider || !userIdRaw || !issuedAtRaw || !sig) return null;

  const payload = `${providerRaw}:${userIdRaw}:${issuedAtRaw}`;
  const expected = hmacSign(payload, env.authSecret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const userId = Number(userIdRaw);
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > 15 * 60 * 1000) return null;
  return userId;
}
