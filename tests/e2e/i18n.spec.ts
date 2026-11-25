import { expect, request, test } from "@playwright/test";
import { apiUser, BASE, json, mails, pageAs } from "./helpers";

// The admin's RU | EN switch changes the language of every screen, every
// API error and every email. The suite runs in English, so put it back.
test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const admin = await apiUser("admin@example.com");
  await json(admin, "post", "/api/admin/locale", { locale: "en" });
});

test("the admin's language switch turns the whole party Russian, and back", async ({ browser }) => {
  const admin = await apiUser("admin@example.com", "Vlad");
  const adminPage = await pageAs(browser, admin);
  await adminPage.goto("/admin");
  await adminPage.getByRole("group", { name: "Language" }).getByRole("button", { name: "RU" }).click();
  await expect(adminPage.locator("html")).toHaveAttribute("lang", "ru");
  await expect(adminPage).toHaveTitle("Тайный Крампус");
  expect((await json(admin, "get", "/api/live/state")).locale).toBe("ru");

  // A guest's phone, not signed in yet.
  const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await guest.goto("/login");
  await expect(guest.locator("html")).toHaveAttribute("lang", "ru");
  await expect(guest.getByRole("button", { name: "Получить код" })).toBeVisible();

  // The TV, with Russian in the festive Cyrillic face (Mountains of Christmas has none).
  const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await tv.goto("/live?preview=1");
  await json(admin, "post", "/api/admin/scene", { kind: "leaderboard" });
  await expect(tv.getByText("🏆 Общий зачёт")).toBeVisible();
  await expect
    .poll(() =>
      tv.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Kurale" && f.status === "loaded");
      }),
    )
    .toBe(true);

  // Server copy follows too: API errors and emails.
  const bad = await admin.post("/api/admin/people", { data: { name: "  " } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toBe("Имя не может быть пустым.");
  const before = Date.now();
  await apiUser("ivan@example.com", "Иван");
  expect(mails("ivan@example.com").filter((m) => m.at >= before).at(-1)?.subject).toMatch(/^Код для входа в Тайный Крампус: \d{6}$/);

  // Other sites still can't change it, and English comes back.
  const anon = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE } });
  expect((await anon.post("/api/admin/locale", { data: { locale: "en" } })).status()).toBe(401);
  await adminPage.getByRole("group", { name: "Язык" }).getByRole("button", { name: "EN" }).click();
  await expect(adminPage.locator("html")).toHaveAttribute("lang", "en");
  await expect(guest.getByRole("button", { name: "Send me a code" })).toBeVisible(); // live, no reload
  await expect(tv.getByText("🏆 Overall standings")).toBeVisible();

  for (const p of [adminPage, guest, tv]) await p.context().close();
});
