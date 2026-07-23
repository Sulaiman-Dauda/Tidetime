import "server-only";

export interface OAuthCreds {
  clientId: string;
  clientSecret: string;
}

/** Google Calendar is the only OAuth integration in the lite build. */
export async function getGoogleCreds(): Promise<OAuthCreds | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
