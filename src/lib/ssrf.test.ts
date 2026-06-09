import { describe, expect, it } from "vitest";
import { isBlockedIp, isBlockedHostname } from "./ssrf";

describe("isBlockedIp", () => {
  it("blocks private and loopback IPv4 ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "0.0.0.0",
      "100.64.0.1", // CGNAT
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4 addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "203.0.113.10", "172.32.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("blocks IPv6 loopback, unique-local, link-local and mapped private v4", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks internal hostnames", () => {
    for (const host of [
      "localhost",
      "foo.localhost",
      "db.internal",
      "service.local",
      "metadata.google.internal",
      "127.0.0.1",
      "192.168.0.10",
    ]) {
      expect(isBlockedHostname(host), host).toBe(true);
    }
  });

  it("allows public hostnames", () => {
    for (const host of ["example.com", "hooks.slack.com", "api.stripe.com"]) {
      expect(isBlockedHostname(host), host).toBe(false);
    }
  });
});
