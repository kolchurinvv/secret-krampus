import { expect, test, type Page } from "@playwright/test";
import { apiUser, pageAs } from "./helpers";

const TABS = ["People", "Santa", "Krampus", "Contests", "TV"];

// Pages made with pageAs() live in their own contexts; close them so they
// don't linger into later specs (or their failure screenshots).
let opened: Page[] = [];
test.afterEach(async () => {
  for (const p of opened) await p.context().close();
  opened = [];
});
const track = (p: Page) => (opened.push(p), p);

test.describe("admin console", () => {
  test("renders for an admin", async ({ browser }) => {
    const admin = await apiUser("admin@example.com", "Vlad");
    const page = track(await pageAs(browser, admin, { width: 1280, height: 800 }));
    await page.goto("/admin");
    for (const tab of TABS) await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
  });

  test("tells a non-admin they aren't one", async ({ browser }) => {
    const guest = await apiUser("not-admin@example.com", "Nadia");
    const page = track(await pageAs(browser, guest));
    await page.goto("/admin");
    await expect(page.getByText("You're not an admin")).toBeVisible();
  });
});

test.describe("after a deploy", () => {
  test("missing files 404 instead of serving the app", async ({ request }) => {
    expect((await request.get("/assets/Admin-OLDHASH.js")).status()).toBe(404);
    expect((await request.get("/sfx/sad-trombone.mp3")).status()).toBe(404);
    const spa = await request.get("/admin");
    expect(spa.status()).toBe(200);
    expect(spa.headers()["content-type"]).toContain("text/html");
  });

  test("a tab with a vanished page chunk reloads itself and recovers", async ({ browser }) => {
    const admin = await apiUser("admin@example.com");
    const page = track(await pageAs(browser, admin, { width: 1280, height: 800 }));
    let requests = 0;
    await page.route(/\/assets\/Admin-[^/]+\.js$/, (route) => (++requests === 1 ? route.fulfill({ status: 404 }) : route.continue()));
    await page.goto("/admin");
    await expect(page.getByText("Contests", { exact: true }).first()).toBeVisible();
    expect(requests).toBe(2); // failed once, reloaded, loaded
  });

  test("a page that can't load shows a reload screen, not a blank page", async ({ browser }) => {
    const admin = await apiUser("admin@example.com");
    const page = track(await pageAs(browser, admin, { width: 1280, height: 800 }));
    await page.route(/\/assets\/Admin-[^/]+\.js$/, (route) => route.fulfill({ status: 404 }));
    await page.goto("/admin");
    await expect(page.getByText("The elves dropped something")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  });
});
