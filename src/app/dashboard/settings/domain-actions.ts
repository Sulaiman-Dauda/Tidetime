"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getCustomDomain, normalizeDomain, setCustomDomain } from "@/server/app-url";

export type DomainState = {
  ok?: boolean;
  error?: string;
  domain?: string | null;
  live?: boolean;
} | null;

/** Save (or clear, when empty) the custom domain. Takes effect immediately:
 *  the bundled Caddy proxy starts answering for it as soon as DNS resolves. */
export async function updateCustomDomainAction(
  _prev: DomainState,
  formData: FormData,
): Promise<DomainState> {
  await requireAdmin();
  const raw = String(formData.get("domain") ?? "").trim();

  if (raw === "") {
    await setCustomDomain(null);
    revalidatePath("/dashboard/settings");
    revalidatePath("/", "layout");
    return { ok: true, domain: null };
  }

  const domain = normalizeDomain(raw);
  if (!domain) {
    return { error: "Enter a bare domain like calendar.example.com — no http:// or paths." };
  }
  await setCustomDomain(domain);
  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
  return { ok: true, domain };
}

/** Probe https://<domain>/api/health from the server. The first successful
 *  probe also triggers Caddy's on-demand certificate issuance, so "checking"
 *  doubles as activation. */
export async function checkCustomDomainAction(): Promise<DomainState> {
  await requireAdmin();
  const domain = await getCustomDomain();
  if (!domain) return { error: "Save a domain first, then check again." };
  try {
    const res = await fetch(`https://${domain}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000), // first hit may include cert issuance
    });
    return { ok: true, domain, live: res.ok };
  } catch {
    return { ok: true, domain, live: false };
  }
}
