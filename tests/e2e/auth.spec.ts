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

  test("rejects a login request from another site", async () => {
    const evil = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: "https://evil.example" } });
    const res = await evil.post("/api/auth/email-otp/send-verification-otp", {
      data: { email: "victim@example.com", type: "sign-in" },
    });
    expect(res.status()).toBe(403);
  });
});
