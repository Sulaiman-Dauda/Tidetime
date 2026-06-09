import "server-only";
import { isMicrosoftConfigured } from "@/server/calendar/microsoft";
import { hasCredential } from "@/server/calendar/store";
import type { AppDefinition } from "../types";
import { appMeta } from "../types";

/**
 * Microsoft Teams meetings. Teams links are minted natively when we create the
 * Outlook calendar event (isOnlineMeeting=true), so this app has no standalone
 * VideoApp — it simply requires the user's Microsoft 365 calendar connection,
 * and conferencing.ts routes the booking through native Graph conferencing.
 */

export const msTeamsApp: AppDefinition = {
  meta: appMeta("office365_video")!,
  isConfigured: () => isMicrosoftConfigured(),
  isInstalled: (userId) => hasCredential(userId, "office365_calendar"),
};
