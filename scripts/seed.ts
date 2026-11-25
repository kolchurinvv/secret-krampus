// Seed fake party data for local development, or keep awarding random stars to
// exercise the TV leaderboard.
//
//   bun scripts/seed.ts             # seed, unless participants already exist
//   bun scripts/seed.ts --reset     # wipe app data first (accounts are kept)
//   bun scripts/seed.ts --simulate  # award a star to 1–3 people every 3 s
//
// Writes go straight to the SQLite file (DATABASE_PATH, default
// ./data/krampus.db). A running server notices them through PRAGMA
// data_version polling and pushes the change to every screen.
import { count, isNull } from "drizzle-orm";
import type { ContestKind } from "../src/shared/types";
import { db, schema } from "../src/server/db";

const { participant, contest, star, giftVote, santaAssignment, appState } = schema;

const args = new Set(Bun.argv.slice(2));

const NAMES = [
  "Anna Frost",
  "Boris Pine",
  "Clara Holly",
  "Dmitri Sleigh",
  "Elsa Tinsel",
  "Felix Nutcracker",
  "Greta Gingerbread",
  "Hugo Mistletoe",
  "Ida Snowdrop",
  "Jonas Evergreen",
  "Klara Candycane",
  "Leo Jingle",
  "Mila Cocoa",
  "Nikolai Reindeer",
];

const WISHES = [
  "Fuzzy socks, the louder the better",
  "Anything with cinnamon",
  "A book I wouldn't pick myself",
  "Board games!",
  "Hot sauce, the dangerous kind",
  "",
];

const CONTESTS: { name: string; kind: ContestKind }[] = [
  { name: "Ugly Sweater", kind: "individual" },
  { name: "Carol Karaoke", kind: "team" },
  { name: "Gingerbread Build", kind: "team" },
];

function pickRandom<T>(items: readonly T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

function reset() {
  db.transaction((tx) => {
    tx.delete(star).run();
    tx.delete(giftVote).run();
    tx.delete(santaAssignment).run();
    tx.update(appState)
      .set({
        scene: "title",
        sceneStartedAt: new Date(),
        sceneMessage: "",
        drawDoneAt: null,
        voteRound: 0,
        voteStatus: "closed",
        voteGiftIds: [],
        krampusIds: [],
        krampusScore: null,
        revealedKrampus: false,
        championIds: [],
        championStars: 0,
        revealedChampion: false,
        currentContestId: null,
      })
      .run();
    tx.delete(contest).run();
    // People who signed up keep their participant row (it's tied to their
    // login); only admin-created and seeded people go.
    tx.delete(participant).where(isNull(participant.userId)).run();
  });
  console.log("reset: app data wiped (accounts and their participants kept)");
}

function seed() {
  const existing = db.select({ n: count() }).from(participant).get()?.n ?? 0;
  if (existing > 0) {
    console.log(`seed: ${existing} participants already exist — skipping (use --reset to start over)`);
    return;
  }
  db.transaction((tx) => {
    const people = tx
      .insert(participant)
      .values(NAMES.map((name) => ({ name, inSanta: true, wishlist: pickRandom(WISHES, 1)[0] ?? "" })))
      .returning({ id: participant.id })
      .all();
    const contests = tx.insert(contest).values(CONTESTS).returning({ id: contest.id, kind: contest.kind }).all();

    // A few finished contests: one winner for individual ones, a team of 3–5 otherwise.
    for (const c of contests) {
      const winners = pickRandom(people, c.kind === "team" ? randInt(3, 5) : 1);
      const awardBatchId = crypto.randomUUID();
      tx.insert(star)
        .values(winners.map((p) => ({ participantId: p.id, contestId: c.id, awardBatchId })))
        .run();
    }
    tx.update(appState).set({ currentContestId: contests[0]?.id ?? null }).run();
  });
  console.log(`seed: ${NAMES.length} participants, ${CONTESTS.length} contests, some stars`);
}

function simulate() {
  console.log("simulate: awarding a star to 1–3 random people every 3 s (Ctrl-C to stop)");
  setInterval(() => {
    const people = db.select({ id: participant.id, name: participant.name }).from(participant).all();
    if (people.length === 0) {
      console.log("simulate: no participants yet — run `just seed` first");
      return;
    }
    const contests = db.select({ id: contest.id, name: contest.name }).from(contest).all();
    const c = contests.length ? pickRandom(contests, 1)[0]! : null;
    const winners = pickRandom(people, randInt(1, Math.min(3, people.length)));
    const awardBatchId = crypto.randomUUID();
    db.insert(star)
      .values(winners.map((p) => ({ participantId: p.id, contestId: c?.id ?? null, awardBatchId })))
      .run();
    console.log(`⭐ +1 → ${winners.map((w) => w.name).join(", ")}${c ? ` (${c.name})` : ""}`);
  }, 3000);
}

if (args.has("--reset")) reset();
if (args.has("--simulate")) simulate();
else seed();
