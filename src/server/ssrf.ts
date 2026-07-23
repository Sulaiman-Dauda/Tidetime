import "server-only";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isBlockedHostname, isBlockedIp } from "@/lib/ssrf";

interface ResolvedPublicUrl {
  url: URL;
  address: string;
  family: 4 | 6;
}

/**
 * Authoritative SSRF guard for outbound requests to user-supplied URLs. Throws
 * unless `rawUrl` is an http(s) URL whose hostname resolves exclusively to
 * publicly routable addresses.
 */
async function resolvePublicUrl(rawUrl: string): Promise<ResolvedPublicUrl> {
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

  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(url.hostname, { all: true });
  } catch {
    throw new Error("URL host could not be resolved");
  }
  if (addrs.length === 0 || addrs.some((a) => isBlockedIp(a.address))) {
    throw new Error("URL resolves to a non-public address");
  }
  const selected = addrs[0];
  if (selected.family !== 4 && selected.family !== 6) {
    throw new Error("URL resolved to an unsupported address");
  }
  return { url, address: selected.address, family: selected.family };
}

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  return (await resolvePublicUrl(rawUrl)).url;
}

/**
 * Send a POST to a validated public URL while pinning the connection to the
 * verified address. This closes the DNS lookup/fetch race used by rebinding
 * attacks while preserving the original Host header and TLS server name.
 */
export async function postPublicUrl(input: {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}): Promise<number> {
  const { url, address, family } = await resolvePublicUrl(input.url);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<number>((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        headers: input.headers,
        servername: url.hostname,
        lookup: (_hostname, _options, callback) => {
          callback(null, address, family);
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    req.setTimeout(input.timeoutMs, () => {
      req.destroy(new Error("Webhook request timed out"));
    });
    req.on("error", reject);
    req.end(input.body);
  });
}
