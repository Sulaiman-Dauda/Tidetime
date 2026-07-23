import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  httpRequest: vi.fn(),
  httpsRequest: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ request: mocks.httpRequest }));
vi.mock("node:https", () => ({ request: mocks.httpsRequest }));

import { assertPublicUrl, postPublicUrl } from "./ssrf";

function requestStub(
  _url: URL,
  options: {
    lookup: (
      hostname: string,
      options: object,
      callback: (error: Error | null, address: string, family: number) => void,
    ) => void;
  },
  onResponse: (response: { statusCode: number; resume: () => void }) => void,
) {
  options.lookup("hooks.example.com", {}, (_error, address, family) => {
    expect(address).toBe("93.184.216.34");
    expect(family).toBe(4);
  });
  onResponse({ statusCode: 204, resume: vi.fn() });
  return {
    setTimeout: vi.fn(),
    on: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
  };
}

describe("server-side outbound URL protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    mocks.httpRequest.mockImplementation(requestStub);
    mocks.httpsRequest.mockImplementation(requestStub);
  });

  it("rejects URLs resolving to private addresses", async () => {
    mocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(assertPublicUrl("https://hooks.example.com")).rejects.toThrow(
      /non-public address/i,
    );
  });

  it("pins webhook delivery to the address that passed validation", async () => {
    const status = await postPublicUrl({
      url: "https://hooks.example.com/events",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      timeoutMs: 10_000,
    });

    expect(status).toBe(204);
    expect(mocks.httpsRequest).toHaveBeenCalledOnce();
  });

  it("rejects non-HTTP protocols before DNS resolution", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/http/i);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});
