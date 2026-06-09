/**
 * SSRF guards for outbound requests to user-supplied URLs (webhooks, etc.).
 *
 * Two layers:
 *  - `isBlockedHostname` / `isBlockedIp`: fast, synchronous, literal checks used
 *    at registration time for good UX and cheap defence.
 *  - `assertPublicUrl`: authoritative async check that resolves DNS and verifies
 *    every resolved address is publicly routable. Use this immediately before the
 *    actual fetch so DNS-rebinding can't slip an internal address past validation.
 */

/** Parse a dotted IPv4 string into four octets, or null if not valid IPv4. */
function parseIpv4(host: string): [number, number, number, number] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1).map(Number) as [number, number, number, number];
  if (octets.some((o) => o > 255)) return null;
  return octets;
}

/** True when an IPv4 address falls in a private, loopback, or otherwise non-public range. */
function isBlockedIpv4(host: string): boolean {
  const o = parseIpv4(host);
  if (!o) return false;
  const [a, b] = o;
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local incl. 169.254.169.254 cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
    (a === 192 && b === 0 && o[2] === 0) || // 192.0.0.0/24 IETF protocol assignments
    a >= 224 // multicast / reserved / broadcast
  );
}

/** True for IPv6 loopback, unspecified, unique-local, link-local, or mapped/embedded private IPv4. */
function isBlockedIpv6(raw: string): boolean {
  const host = raw.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "::1" || host === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded IPv4.
  const mapped = host.match(/(?:::ffff:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  const head = host.split(":")[0] ?? "";
  // fc00::/7 unique-local (fc.. / fd..) and fe80::/10 link-local.
  return /^f[cd]/.test(head) || /^fe[89ab]/.test(head);
}

/** Synchronous check of a literal IP address. */
export function isBlockedIp(host: string): boolean {
  return host.includes(":") ? isBlockedIpv6(host) : isBlockedIpv4(host);
}

/**
 * Synchronous hostname check. Blocks obvious internal targets and literal private
 * IPs. Does NOT resolve DNS — use `assertPublicUrl` for the authoritative check.
 */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "metadata.google.internal") return true;
  return isBlockedIp(host);
}
