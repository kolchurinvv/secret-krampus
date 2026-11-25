import { expect, request, test } from "@playwright/test";
import { BASE, loginUI } from "./helpers";

test.describe("login", () => {
  test("signs in with an email code on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginUI(page, "phoebe@example.com", "Phoebe");
    await expect(page.getByText("Phoebe").first()).toBeVisible();
    await expect(page.getByText("Your Secret Santa match")).toBeVisible();
  });

  test("a party's worth of guests on one Wi-Fi can all get codes", async () => {
    // Everyone at the venue shares one public IP; Better Auth's default of
    // 3 code requests per minute per IP would lock out the 4th guest.
    const wifi = await request.newContext({
      baseURL: BASE,
      extraHTTPHeaders: { origin: BASE, "x-forwarded-for": "203.0.113.7" },
    });
    for (let i = 1; i <= 12; i++) {
      const res = await wifi.post("/api/auth/email-otp/send-verification-otp", {
        data: { email: `wifi-guest-${i}@example.com`, type: "sign-in" },
      });
      expect(res.status(), `code request ${i}`).toBe(200);
    }
  });

  test("behind the Cloudflare proxy, each guest still gets their own login limit", async () => {
    // 25 visitors arriving through one Cloudflare edge server (104.16.0.1):
    // Cloudflare names each one in CF-Connecting-IP.
    const edge = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE, "x-forwarded-for": "104.16.0.1" } });
    for (let i = 1; i <= 25; i++) {
      const res = await edge.post("/api/auth/email-otp/send-verification-otp", {
        headers: { "cf-connecting-ip": `198.51.100.${i}` },
        data: { email: `cf-guest-${i}@example.com`, type: "sign-in" },
      });
      expect(res.status(), `visitor ${i}`).toBe(200);
    }
  });

  test("a faked Cloudflare header from outside Cloudflare doesn't dodge the limit", async () => {
    const faker = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE, "x-forwarded-for": "203.0.113.99" } });
    const statuses: number[] = [];
    for (let i = 1; i <= 25; i++) {
      const res = await faker.post("/api/auth/email-otp/send-verification-otp", {
        headers: { "cf-connecting-ip": `192.0.2.${i}` },
        data: { email: `faker-${i}@example.com`, type: "sign-in" },
      });
      statuses.push(res.status());
    }
    expect(statuses.slice(0, 20).every((st) => st === 200)).toBe(true);
    expect(statuses.slice(20)).toContain(429);
  });

  test("rejects a login request from another site", async () => {
    const evil = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: "https://evil.example" } });
    const res = await evil.post("/api/auth/email-otp/send-verification-otp", {
      data: { email: "victim@example.com", type: "sign-in" },
    });
    expect(res.status()).toBe(403);
  });
});
