import { describe, expect, test } from "bun:test";
import { clientIp, CLIENT_IP_HEADER, isCloudflare, withClientIp } from "./client-ip";

const h = (o: Record<string, string>) => new Headers(o);

describe("clientIp", () => {
  test("DNS only: the address Traefik saw", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  test("proxied: Cloudflare's CF-Connecting-IP, since the hop is a Cloudflare edge", () => {
    expect(clientIp(h({ "x-forwarded-for": "104.16.0.1", "cf-connecting-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(h({ "x-forwarded-for": "2606:4700:10::1", "cf-connecting-ip": "2001:db8::9" }))).toBe("2001:db8::9");
  });

  test("a faked CF-Connecting-IP from outside Cloudflare is ignored", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7", "cf-connecting-ip": "1.2.3.4" }))).toBe("203.0.113.7");
  });

  test("only the last hop (the one Traefik appended) counts", () => {
    expect(clientIp(h({ "x-forwarded-for": "104.16.0.1, 203.0.113.7", "cf-connecting-ip": "1.2.3.4" }))).toBe("203.0.113.7");
  });

  test("no forwarded header: unknown", () => {
    expect(clientIp(h({}))).toBeNull();
  });

  test("Cloudflare ranges", () => {
    expect(isCloudflare("172.67.152.241")).toBe(true); // kolchurin.dev's proxied A record
    expect(isCloudflare("135.125.237.68")).toBe(false); // ovh-s1
    expect(isCloudflare("not an ip")).toBe(false);
  });
});

describe("withClientIp", () => {
  test("replaces any client-sent copy of the header", () => {
    const req = new Request("http://x/api/auth/x", {
      method: "POST",
      headers: { [CLIENT_IP_HEADER]: "6.6.6.6", "x-forwarded-for": "203.0.113.7" },
      body: "{}",
    });
    expect(withClientIp(req).headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    const bare = new Request("http://x/", { headers: { [CLIENT_IP_HEADER]: "6.6.6.6" } });
    expect(withClientIp(bare).headers.get(CLIENT_IP_HEADER) || null).toBeNull();
  });
});
