// The visitor's real IP, for Better Auth's per-IP login rate limits.
//
// Traefik doesn't trust forwarded headers from the internet, so the last hop
// in X-Forwarded-For is whoever actually connected to it: the guest when the
// DNS record is "DNS only", or a Cloudflare edge server when it's proxied. In
// the proxied case every guest would look like a handful of Cloudflare IPs and
// share one rate-limit bucket, so the real address is taken from
// CF-Connecting-IP — but only when the connection really came from Cloudflare,
// otherwise anyone reaching the server directly could fake the header to dodge
// the limit.
import { BlockList, isIP } from "node:net";

/** https://www.cloudflare.com/ips/ (fetched 2026-11-25; they change rarely). */
const CLOUDFLARE_V4 = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
];
const CLOUDFLARE_V6 = [
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
  "2a06:98c0::/29", "2c0f:f248::/32",
];

const cloudflare = new BlockList();
for (const c of CLOUDFLARE_V4) cloudflare.addSubnet(c.split("/")[0]!, Number(c.split("/")[1]), "ipv4");
for (const c of CLOUDFLARE_V6) cloudflare.addSubnet(c.split("/")[0]!, Number(c.split("/")[1]), "ipv6");

export function isCloudflare(ip: string): boolean {
  const v = isIP(ip);
  return v !== 0 && cloudflare.check(ip, v === 6 ? "ipv6" : "ipv4");
}

export function clientIp(headers: Headers): string | null {
  const hop = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
  const viaCloudflare = headers.get("cf-connecting-ip")?.trim();
  if (hop && viaCloudflare && isCloudflare(hop) && isIP(viaCloudflare)) return viaCloudflare;
  return hop;
}

/** Header the server sets (after dropping any client-sent copy) for Better Auth to read. */
export const CLIENT_IP_HEADER = "x-sk-client-ip";

export function withClientIp(req: Request): Request {
  const headers = new Headers(req.headers);
  // Always overwrite, never just delete: Bun's `new Request(req, { headers })`
  // keeps a header that is missing from `headers`, so a deleted client copy
  // would survive. An empty value reads as "unknown" to Better Auth.
  headers.set(CLIENT_IP_HEADER, clientIp(req.headers) ?? "");
  return new Request(req, { headers });
}
