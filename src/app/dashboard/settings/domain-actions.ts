"use server";

import tls from "node:tls";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getCustomDomain, normalizeDomain, setCustomDomain } from "@/server/app-url";

export type DomainState = {
  ok?: boolean;
  error?: string;
  domain?: string | null;
  live?: boolean;
  /** How the domain was verified: over the public internet, or directly
   *  against the bundled proxy (when the server can't reach its own public
   *  IP from inside a container — hairpin NAT — although browsers can). */
  via?: "public" | "proxy";
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

/** Probe https://<domain> over the public internet. */
async function probePublic(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * TLS handshake against the bundled Caddy service with the domain as SNI.
 * Succeeds only when Caddy holds (or can obtain right now — the handshake
 * itself triggers on-demand issuance) a publicly valid certificate for the
 * domain. This sidesteps hairpin-NAT: a container often can't dial its own
 * host's public IP even though the rest of the world can.
 */
function probeViaProxy(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      // First issuance includes a Let's Encrypt round-trip; give it time.
      { host: "caddy", port: 443, servername: domain, timeout: 20000 },
      () => {
        resolve(socket.authorized);
        socket.end();
      },
    );
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** Check whether the saved domain is live. The first successful probe also
 *  triggers Caddy's on-demand certificate issuance, so "checking" doubles
 *  as activation. */
export async function checkCustomDomainAction(): Promise<DomainState> {
  await requireAdmin();
  const domain = await getCustomDomain();
  if (!domain) return { error: "Save a domain first, then check again." };

  if (await probePublic(domain)) {
    return { ok: true, domain, live: true, via: "public" };
  }
  if (await probeViaProxy(domain)) {
    return { ok: true, domain, live: true, via: "proxy" };
  }
  return { ok: true, domain, live: false };
}
