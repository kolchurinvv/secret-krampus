import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { apiUser, confirmIfAsked, json, mails, pageAs, watchPause } from "./helpers";

// The whole evening, in order, against one server: sign-ups, the draw, a late
// joiner, contest stars on the TV, Krampus voting with a tie-break, the reveal.
test.describe.configure({ mode: "serial" });

const GUESTS = ["Anna", "Boris", "Clara"];
const email = (name: string) => `${name.toLowerCase()}@party.example`;
const assignmentMails = () => mails().filter((m) => /Secret Santa match|Plot twist/i.test(m.subject));

let admin: APIRequestContext;
const guests: Record<string, APIRequestContext> = {};
let adminPage: Page;
let tv: Page;

test.beforeAll(async ({ browser }) => {
  admin = await apiUser("admin@example.com", "Vlad");
  for (const g of GUESTS) guests[g] = await apiUser(email(g), g);
  // Other spec files sign people up too; keep the draw to this party.
  const party = new Set(["Vlad", ...GUESTS]);
  for (const p of await participants()) {
    if (!party.has(p.name)) await json(admin, "patch", `/api/admin/people/${p.id}`, { inSanta: false });
  }
  adminPage = await pageAs(browser, admin);
  tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await tv.goto("/live?preview=1");
});

async function tab(name: string) {
  await adminPage.goto("/admin");
  await adminPage.getByText(name, { exact: true }).first().click();
}

async function participants() {
  return (await json(admin, "get", "/api/admin/state")).people as { id: string; name: string; stars: number }[];
}

test("the admin draws names and the matches go out by email", async () => {
  const before = assignmentMails().length;
  await tab("Santa");
  await adminPage.getByRole("button", { name: /Assign gifters/ }).click();
  await confirmIfAsked(adminPage);
  await expect(adminPage.getByText("0 waiting")).toBeVisible();
  await adminPage.getByRole("button", { name: /Send pending emails/ }).click();
  await confirmIfAsked(adminPage);
  await expect.poll(() => assignmentMails().length - before).toBe(4); // Vlad + 3 guests
  expect((await json(admin, "get", "/api/admin/state")).santa.assigned).toBe(4);

  const receivers = new Set<string>();
  for (const g of GUESTS) {
    const me = await json(guests[g]!, "get", "/api/me");
    expect(me.match.state).toBe("assigned");
    expect(me.match.receiver.id).not.toBe(me.participant.id);
    receivers.add(me.match.receiver.id);
  }
  expect(receivers.size).toBe(3);
});

test("a late joiner changes exactly one existing match", async () => {
  guests.Dmitri = await apiUser(email("Dmitri"), "Dmitri");
  const before = assignmentMails();
  await tab("Santa");
  // With someone waiting, the button names them: "Assign 1 late joiner".
  await adminPage.getByRole("button", { name: "Assign 1 late joiner" }).click();
  await confirmIfAsked(adminPage);
  await adminPage.getByRole("button", { name: /Send pending emails/ }).click();
  await confirmIfAsked(adminPage);
  await expect.poll(() => assignmentMails().length - before.length).toBe(2);
  const fresh = assignmentMails().slice(before.length);
  expect(fresh.filter((m) => /Plot twist/i.test(m.subject))).toHaveLength(1);
  expect(fresh.some((m) => m.to === email("Dmitri"))).toBe(true);
});

test("stars need a contest, climb the TV leaderboard, and can be taken back", async () => {
  await json(admin, "post", "/api/admin/scene", { kind: "leaderboard" });
  await expect(tv.locator('[data-scene="leaderboard"]')).toBeVisible();

  await tab("Contests");
  const box = (name: string) => adminPage.locator(".sk-selectable").filter({ hasText: name }).locator('input[type="checkbox"]');
  const select = async (name: string) => {
    await adminPage.locator(".sk-selectable").filter({ hasText: name }).locator(".sk-pick").click();
    await expect(box(name)).toBeChecked();
  };
  // No contest picked → nobody can be selected.
  await expect(adminPage.getByText("Pick a contest above to award stars.")).toBeVisible();
  await expect(box("Clara")).toBeDisabled();

  // Add a contest; it becomes the picked one and unlocks the players.
  await adminPage.locator(".sk-contest-add input").fill("Ugly sweater");
  await adminPage.getByRole("button", { name: "Add" }).click();
  await expect(adminPage.getByText(/Awarding in/)).toContainText("Ugly sweater");
  await expect(box("Clara")).toBeEnabled();

  for (const n of ["Clara", "Dmitri"]) await select(n);
  await adminPage.getByRole("button", { name: "+1 ⭐" }).click();
  await select("Clara");
  await adminPage.getByRole("button", { name: "+1 ⭐" }).click();
  // Oops — Dmitri didn't deserve his: −1 from the bar.
  await select("Dmitri");
  await adminPage.getByRole("button", { name: /−1/ }).click();

  await expect
    .poll(async () => Object.fromEntries((await participants()).map((p) => [p.name, p.stars])))
    .toMatchObject({ Clara: 2, Dmitri: 0 });
  await expect(tv.locator(".sc-lb-name").first()).toHaveText("Clara");
  await watchPause(tv, 3000);
  const lb = await json(admin, "get", "/api/live/state");
  expect(lb.lastAward.contestName).toBe("Ugly sweater");
});

test("a contest with stars can't be deleted until it's zeroed out", async () => {
  await tab("Contests");
  const row = adminPage.locator(".sk-contest-list > li").filter({ hasText: "Ugly sweater" });
  const del = row.getByRole("button", { name: "Delete Ugly sweater" });
  await expect(row).toContainText("⭐ 2");
  await expect(del).toBeDisabled();
  const id = (await json(admin, "get", "/api/admin/state")).contests.find((c: { name: string }) => c.name === "Ugly sweater").id;
  expect((await admin.delete(`/api/admin/contests/${id}`)).status()).toBe(409); // the server refuses too

  // Take back both of Clara's stars in this contest.
  for (let i = 0; i < 2; i++) {
    await adminPage.locator(".sk-selectable").filter({ hasText: "Clara" }).locator(".sk-pick").click();
    await adminPage.getByRole("button", { name: /−1/ }).click();
    await expect(row).toContainText(`⭐ ${1 - i}`);
  }
  await expect(del).toBeEnabled();
  await del.click();
  await confirmIfAsked(adminPage);
  await expect(adminPage.locator(".sk-contest-list > li").filter({ hasText: "Ugly sweater" })).toHaveCount(0);
  await expect(adminPage.getByText("Pick a contest above to award stars.")).toBeVisible();
});

test("a tied Krampus vote goes to round 2 on its own, then the reveal", async () => {
  await tab("Krampus");
  await adminPage.getByRole("button", { name: /Open voting/ }).click();
  await confirmIfAsked(adminPage);
  await expect(tv.locator('[data-scene="voting"]')).toBeVisible();

  // Round 1: everyone rates the gift they got; two gifts tie for the bottom.
  const everyone = { Vlad: admin, ...guests };
  const ids = Object.fromEntries((await participants()).map((p) => [p.name, p.id]));
  const low = new Set(["Anna", "Boris"]);
  for (const [name, ctx] of Object.entries(everyone)) {
    await json(ctx, "post", "/api/me/vote", { forId: ids[name], score: low.has(name) ? 2 : 8 });
  }
  await expect(tv.getByText("It's a tie!")).toBeVisible();
  await watchPause(tv, 3000);
  const tie = await json(admin, "get", "/api/live/state");
  expect(tie.voting.round).toBe(2);
  expect(tie.voting.gifts.map((g: { forName: string }) => g.forName).sort()).toEqual(["Anna", "Boris"]);
  // Everyone gets the tied gifts minus the one they gave — which one that is
  // depends on the random draw, so check the rule rather than fixed names.
  const tied = ["Anna", "Boris"];
  for (const [name, ctx] of Object.entries(everyone)) {
    const me = await json(ctx, "get", "/api/me");
    const gave = me.match.state === "assigned" ? me.match.receiver.name : null;
    const expected = tied.filter((t) => t !== gave);
    expect(me.voting.tasks.map((t: { forName: string }) => t.forName).sort(), `${name}'s round-2 gifts`).toEqual(expected);
  }

  // Round 2: everyone except each gift's giver rates the tied gifts; Anna's loses.
  for (const ctx of Object.values(everyone)) {
    const me = await json(ctx, "get", "/api/me");
    for (const t of me.voting.tasks) {
      await json(ctx, "post", "/api/me/vote", { forId: t.forId, score: t.forName === "Anna" ? 1 : 6 });
    }
  }
  const pub = await json(admin, "get", "/api/live/state");
  expect(pub.voting.status).toBe("done");
  expect(pub.krampus).toBeNull(); // not before the reveal

  await tab("Krampus");
  await adminPage.getByRole("button", { name: /Reveal on TV/ }).click();
  await confirmIfAsked(adminPage);
  const revealed = await json(admin, "get", "/api/live/state");
  expect(revealed.krampus.entries).toHaveLength(1);
  expect(revealed.krampus.entries[0].giftForName).toBe("Anna");
  await expect(tv.locator('[data-scene="krampus"]')).toBeVisible();
  await expect(tv.getByText(/SECRET KRAMPUS/)).toBeVisible({ timeout: 10_000 });
  await watchPause(tv, 8000);
});

test("the champion is crowned on the TV", async () => {
  await json(admin, "post", "/api/admin/contests", { name: "Snowball toss", kind: "individual" });
  const boris = (await participants()).find((p) => p.name === "Boris")!;
  await json(admin, "post", "/api/admin/stars/award", { participantIds: [boris.id] }); // current contest
  await json(admin, "post", "/api/admin/scene", { kind: "leaderboard" });
  await expect(tv.locator(".sc-lb-name").first()).toHaveText("Boris");
  await watchPause(tv, 2000);

  await tab("Contests");
  await adminPage.getByRole("button", { name: /Crown champion/ }).click();
  await confirmIfAsked(adminPage);
  await expect(tv.locator('[data-scene="champion"]')).toBeVisible();
  const pub = await json(admin, "get", "/api/live/state");
  expect(pub.champion).toEqual({ ids: [boris.id], stars: 1 });
  await expect(tv.locator('[data-scene="champion"]').getByText("Boris")).toBeVisible({ timeout: 10_000 });
  await watchPause(tv, 8000);
});
