// Pure Krampus voting rules. A gift is identified by its GIVER's id.
//
// Round 1: each gift is rated only by its recipient.
// Round 2+: only the gifts tied for lowest are left, and every voter except a
//           gift's own giver rates it; the gift's score is the average.
// There is only ever one Krampus: while gifts tie for lowest, another round
// over just those gifts follows, as many times as it takes.

export type Vote = { voterId: string; giftGiverId: string; score: number };

export type RoundContext = {
  round: number;
  /** Giver ids of the gifts in this round. */
  gifts: readonly string[];
  /** giver → receiver for every assignment. */
  receiverOf: ReadonlyMap<string, string>;
  /** People who can vote at all (in the Santa loop AND able to sign in). */
  voters: ReadonlySet<string>;
};

/** Who must rate `gift` in this round. */
export function votersFor(ctx: RoundContext, gift: string): string[] {
  if (ctx.round === 1) {
    const r = ctx.receiverOf.get(gift);
    return r && ctx.voters.has(r) ? [r] : [];
  }
  return [...ctx.voters].filter((v) => v !== gift);
}

/** The gifts `voter` must rate in this round. */
export function giftsFor(ctx: RoundContext, voter: string): string[] {
  return ctx.gifts.filter((g) => votersFor(ctx, g).includes(voter));
}

/** Everyone who owes at least one vote this round. */
export function roundVoters(ctx: RoundContext): string[] {
  const s = new Set<string>();
  for (const g of ctx.gifts) for (const v of votersFor(ctx, g)) s.add(v);
  return [...s];
}

function voteKey(voter: string, gift: string) {
  return voter + "\u0000" + gift;
}

/** Has `voter` cast every vote they owe this round? */
export function hasVotedAll(ctx: RoundContext, votes: readonly Vote[], voter: string): boolean {
  const cast = new Set(votes.map((v) => voteKey(v.voterId, v.giftGiverId)));
  return giftsFor(ctx, voter).every((g) => cast.has(voteKey(voter, g)));
}

/** Average score per gift over the valid votes cast; unrated gifts are absent. */
export function tally(ctx: RoundContext, votes: readonly Vote[]): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const v of votes) {
    if (!ctx.gifts.includes(v.giftGiverId)) continue;
    if (!votersFor(ctx, v.giftGiverId).includes(v.voterId)) continue;
    const s = sums.get(v.giftGiverId) ?? { total: 0, n: 0 };
    s.total += v.score;
    s.n += 1;
    sums.set(v.giftGiverId, s);
  }
  return new Map([...sums].map(([g, s]) => [g, s.total / s.n]));
}

export type Outcome =
  | { kind: "done"; krampusIds: [string]; score: number }
  | { kind: "next-round"; round: number; gifts: string[] }
  /** Nothing rated yet: the round can't be closed, it stays open. */
  | { kind: "no-ratings" };

const EPS = 1e-9;

/** Decides what happens when the admin closes a round. Missing ratings are skipped. */
export function decide(ctx: RoundContext, votes: readonly Vote[]): Outcome {
  const scores = tally(ctx, votes);
  if (scores.size === 0) return { kind: "no-ratings" };
  const min = Math.min(...scores.values());
  const tied = ctx.gifts.filter((g) => scores.has(g) && Math.abs(scores.get(g)! - min) < EPS);
  if (tied.length === 1) return { kind: "done", krampusIds: [tied[0]!], score: min };
  return { kind: "next-round", round: ctx.round + 1, gifts: tied };
}
