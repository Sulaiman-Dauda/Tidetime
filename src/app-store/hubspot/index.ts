import "server-only";
import { getAppUrl } from "@/server/app-url";
import { getHubspotCreds } from "@/server/integration-credentials";
import type { AppDefinition, CrmApp } from "../types";
import { appMeta } from "../types";
import {
  deleteAppCredential,
  hasAppCredential,
  loadAppCredential,
  markAppCredentialInvalid,
  saveAppCredential,
  updateAppCredential,
} from "../credentials";

/**
 * HubSpot CRM via per-user OAuth. On each new booking we upsert the attendee as
 * a contact and log a "meeting" engagement against them. Best-effort: failures
 * never block a booking.
 */

const SLUG = "hubspot";
const AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const API = "https://api.hubapi.com";
const SCOPES = ["crm.objects.contacts.read", "crm.objects.contacts.write"];

interface HubspotTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
}

function clientCreds(): Promise<{ clientId: string; clientSecret: string } | null> {
  return getHubspotCreds();
}

async function isConfigured(): Promise<boolean> {
  return (await clientCreds()) !== null;
}

async function redirectUri(): Promise<string> {
  return `${await getAppUrl()}/api/apps/hubspot/callback`;
}

async function getInstallUrl(state: string): Promise<string> {
  const creds = await clientCreds();
  if (!creds) throw new Error("HubSpot is not configured");
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: await redirectUri(),
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeHubspotCode(code: string, userId: number): Promise<void> {
  const creds = await clientCreds();
  if (!creds) throw new Error("HubSpot is not configured");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: await redirectUri(),
      code,
    }),
  });
  if (!res.ok) throw new Error(`HubSpot token exchange failed (${res.status})`);
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("HubSpot returned no access token");
  await saveAppCredential<HubspotTokens>(userId, SLUG, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + (data.expires_in ?? 1800) * 1000,
  });
}

async function getAccessToken(userId: number): Promise<string | null> {
  const cred = await loadAppCredential<HubspotTokens>(userId, SLUG);
  if (!cred) return null;
  const { id, data: tokens } = cred;
  if (tokens.access_token && tokens.expiry_date && tokens.expiry_date - 60_000 > Date.now()) {
    return tokens.access_token;
  }
  const creds = await clientCreds();
  if (!creds || !tokens.refresh_token) {
    await markAppCredentialInvalid(id);
    return null;
  }
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: tokens.refresh_token,
      }),
    });
    if (!res.ok) throw new Error(`refresh failed ${res.status}`);
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) throw new Error("no access token on refresh");
    const next: HubspotTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      expiry_date: Date.now() + (data.expires_in ?? 1800) * 1000,
    };
    await updateAppCredential(id, next);
    return next.access_token!;
  } catch {
    await markAppCredentialInvalid(id);
    return null;
  }
}

/** Find a contact id by email, or create one. Returns null on failure. */
async function upsertContact(
  token: string,
  contact: { email: string; name?: string; phone?: string },
): Promise<string | null> {
  const [firstname, ...rest] = (contact.name ?? "").trim().split(/\s+/);
  const lastname = rest.join(" ");
  const properties: Record<string, string> = { email: contact.email };
  if (firstname) properties.firstname = firstname;
  if (lastname) properties.lastname = lastname;
  if (contact.phone) properties.phone = contact.phone;

  // Try to create; if it already exists HubSpot returns 409 with the id.
  const res = await fetch(`${API}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties }),
  });
  if (res.ok) {
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  }
  if (res.status === 409) {
    // Already exists — search for the id by email.
    const search = await fetch(`${API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [
          { filters: [{ propertyName: "email", operator: "EQ", value: contact.email }] },
        ],
        limit: 1,
      }),
    });
    if (!search.ok) return null;
    const data = (await search.json()) as { results?: { id?: string }[] };
    return data.results?.[0]?.id ?? null;
  }
  return null;
}

const hubspotCrm: CrmApp = {
  async onBookingCreated(userId, event) {
    const token = await getAccessToken(userId);
    if (!token) return;
    const contactId = await upsertContact(token, event.contact);
    if (!contactId) return;
    // Log a meeting engagement on the contact's timeline.
    await fetch(`${API}/crm/v3/objects/meetings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          hs_timestamp: event.start.getTime(),
          hs_meeting_title: event.title,
          hs_meeting_body: event.description ?? "",
          hs_meeting_location: event.meetingUrl ?? "",
          hs_meeting_start_time: event.start.getTime(),
          hs_meeting_end_time: event.end.getTime(),
          hs_meeting_outcome: "SCHEDULED",
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 200 },
            ],
          },
        ],
      }),
    }).catch(() => undefined);
  },
};

export const hubspotApp: AppDefinition = {
  meta: appMeta("hubspot")!,
  isConfigured,
  isInstalled: (userId) => hasAppCredential(userId, SLUG),
  getInstallUrl,
  uninstall: (userId) => deleteAppCredential(userId, SLUG),
  crm: hubspotCrm,
};
