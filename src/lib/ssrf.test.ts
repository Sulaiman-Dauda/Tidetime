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
      "192.0.0.10",
      "192.0.2.1",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4 addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("blocks IPv6 loopback, unique-local, link-local and mapped private v4", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "2001:db8::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "[::ffff:0a00:1]",
    ]) {
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
    for (const host of ["example.com", "hooks.slack.com", "api.github.com"]) {
      expect(isBlockedHostname(host), host).toBe(false);
    }
  });
});
