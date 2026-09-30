import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pinnedLookup } from "./ssrf";

// Deliberately not mocking node:http. Node 20+ connects with autoSelectFamily,
// which calls lookup with { all: true } and needs an array back; a mocked
// request never exercises that, which is how every webhook failed in
// production with "Invalid IP address: undefined".
let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((_req, res) => res.writeHead(204).end());
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

function get(lookupHost: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      `http://${lookupHost}:${port}/`,
      { lookup: pinnedLookup("127.0.0.1", 4) },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("pinnedLookup through the real http stack", () => {
  it("connects to the pinned address whatever the hostname resolves to", async () => {
    await expect(get("hooks.invalid")).resolves.toBe(204);
  });

  it("answers both lookup shapes Node uses", () => {
    const lookup = pinnedLookup("93.184.216.34", 4);
    const seen: unknown[] = [];
    lookup("x", { all: true }, (_e: unknown, a: unknown) => seen.push(a));
    lookup("x", {}, (_e: unknown, a: unknown, f?: unknown) => seen.push([a, f]));
    expect(seen).toEqual([[{ address: "93.184.216.34", family: 4 }], ["93.184.216.34", 4]]);
  });
});
