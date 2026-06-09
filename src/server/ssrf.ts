import "server-only";
import { lookup } from "node:dns/promises";
import { isBlockedHostname, isBlockedIp } from "@/lib/ssrf";

/**
 * Authoritative SSRF guard for outbound requests to user-supplied URLs. Throws
 * unless `rawUrl` is an http(s) URL whose hostname resolves exclusively to
 * publicly routable addresses. Resolving DNS here (rather than only checking the
 * literal hostname) closes the DNS-rebinding hole. Call immediately before fetch.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("URL host is not allowed");
  }

  let addrs: { address: string }[];
  try {
    addrs = await lookup(url.hostname, { all: true });
  } catch {
    throw new Error("URL host could not be resolved");
  }
  if (addrs.length === 0 || addrs.some((a) => isBlockedIp(a.address))) {
    throw new Error("URL resolves to a non-public address");
  }
  return url;
}
