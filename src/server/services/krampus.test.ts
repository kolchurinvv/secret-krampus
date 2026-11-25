import { describe, expect, test } from "bun:test";
import { decide, giftsFor, hasVotedAll, votersFor, type RoundContext, type Vote } from "./krampus";

// Loop a→b→c→d→e→a; gifts are identified by giver.
const receiverOf = new Map([
  ["a", "b"],
  ["b", "c"],
  ["c", "d"],
  ["d", "e"],
  ["e", "a"],
]);
const voters = new Set(["a", "b", "c", "d", "e"]);
const round1: RoundContext = { round: 1, gifts: ["a", "b", "c", "d", "e"], receiverOf, voters };

/** Round-1 votes: the recipient of `gift` gives it `score`. */
const r1 = (scores: Record<string, number>): Vote[] =>
  Object.entries(scores).map(([gift, score]) => ({ voterId: receiverOf.get(gift)!, giftGiverId: gift, score }));

describe("round 1", () => {
  test("each gift is rated only by its recipient", () => {
    expect(votersFor(round1, "a")).toEqual(["b"]);
    expect(giftsFor(round1, "c")).toEqual(["b"]);
  });

  test("a unique lowest gift crowns its giver", () => {
    const votes = r1({ a: 8, b: 3, c: 9, d: 6, e: 7 });
    expect(decide(round1, votes)).toEqual({ kind: "done", krampusIds: ["b"], score: 3 });
  });

  test("a tie for lowest opens round 2 over just the tied gifts", () => {
    const votes = r1({ a: 2, b: 7, c: 2, d: 6, e: 9 });
    expect(decide(round1, votes)).toEqual({ kind: "next-round", round: 2, gifts: ["a", "c"] });
  });

  test("closing early skips the missing ratings", () => {
    const votes = r1({ a: 5, b: 4, c: 9 });
    expect(hasVotedAll(round1, votes, "b")).toBe(true);
    expect(hasVotedAll(round1, votes, "e")).toBe(false);
    expect(decide(round1, votes)).toEqual({ kind: "done", krampusIds: ["b"], score: 4 });
  });

  test("recipients who can't sign in owe no vote", () => {
    const ctx = { ...round1, voters: new Set(["a", "c", "d", "e"]) }; // b can't vote
    expect(votersFor(ctx, "a")).toEqual([]);
  });

  test("ignores votes from people who don't get a say", () => {
    const votes = [...r1({ a: 8, b: 8, c: 8, d: 8, e: 8 }), { voterId: "a", giftGiverId: "c", score: 1 }];
    expect(decide(round1, votes).kind).toBe("next-round"); // all tied at 8, the stray 1 doesn't count
  });

  test("nothing rated yet → the round can't close", () => {
    expect(decide(round1, [])).toEqual({ kind: "no-ratings" });
  });
});

describe("tie-break rounds", () => {
  const round2: RoundContext = { round: 2, gifts: ["a", "c"], receiverOf, voters };

  test("everyone except the gift's giver rates it", () => {
    expect(votersFor(round2, "a").sort()).toEqual(["b", "c", "d", "e"]);
    expect(giftsFor(round2, "a")).toEqual(["c"]);
    expect(giftsFor(round2, "b")).toEqual(["a", "c"]);
  });

  const everyone = (ctx: RoundContext, score: (gift: string, voter: string) => number): Vote[] =>
    ctx.gifts.flatMap((g) => votersFor(ctx, g).map((v) => ({ voterId: v, giftGiverId: g, score: score(g, v) })));

  test("lowest average wins", () => {
    const votes = everyone(round2, (g) => (g === "a" ? 3 : 4));
    expect(decide(round2, votes)).toEqual({ kind: "done", krampusIds: ["a"], score: 3 });
  });

  test("tied again → another round over the same gifts, never two Krampuses", () => {
    const votes = everyone(round2, () => 5);
    expect(decide(round2, votes)).toEqual({ kind: "next-round", round: 3, gifts: ["a", "c"] });
    const round3: RoundContext = { ...round2, round: 3 };
    expect(decide(round3, everyone(round3, (g) => (g === "c" ? 2 : 5)))).toEqual({
      kind: "done",
      krampusIds: ["c"],
      score: 2,
    });
  });

  test("a tie-break round nobody rated yet can't close", () => {
    expect(decide(round2, [])).toEqual({ kind: "no-ratings" });
  });

  test("a narrowing tie → another round", () => {
    const round2of3: RoundContext = { round: 2, gifts: ["a", "c", "e"], receiverOf, voters };
    const votes = everyone(round2of3, (g) => (g === "e" ? 9 : 2));
    expect(decide(round2of3, votes)).toEqual({ kind: "next-round", round: 3, gifts: ["a", "c"] });
  });
});
