// Krampus voting persistence; the rules are in krampus.ts.
import { and, eq, isNotNull } from "drizzle-orm";
import { db, type DB } from "../db";
import { giftVote, participant } from "../db/schema";
import { MAX_SCORE, MIN_SCORE } from "../../shared/types";
import { UserError } from "../errors";
import { notify } from "../events";
import { decide, votersFor, type RoundContext, type Vote } from "./krampus";
import { loadLoop } from "./santa";
import { getState, patchState } from "./state";
import { tr } from "../messages";

type Q = Pick<DB, "select" | "update">;

/** Who can vote at all: people in the loop who can sign in. */
function eligibleVoters(q: Q, loopIds: Iterable<string>): Set<string> {
  const inLoop = new Set(loopIds);
  return new Set(
    q
      .select({ id: participant.id })
      .from(participant)
      .where(isNotNull(participant.userId))
      .all()
      .map((r) => r.id)
      .filter((id) => inLoop.has(id)),
  );
}

export function roundContext(q: Q = db): RoundContext {
  const state = getState(q);
  const loop = loadLoop(q);
  return {
    round: state.voteRound,
    gifts: state.voteGiftIds,
    receiverOf: loop,
    voters: eligibleVoters(q, loop.keys()),
  };
}

export function roundVotes(round: number, q: Pick<DB, "select"> = db): Vote[] {
  return q
    .select({ voterId: giftVote.voterId, giftGiverId: giftVote.giftGiverId, score: giftVote.score })
    .from(giftVote)
    .where(eq(giftVote.round, round))
    .all();
}

export function openVoting() {
  db.transaction((tx) => {
    const state = getState(tx);
    if (state.voteRound > 0) throw new UserError(tr().votingStarted, 409);
    const loop = loadLoop(tx);
    if (loop.size < 2) throw new UserError(tr().assignFirst);
    patchState(
      {
        voteRound: 1,
        voteStatus: "open",
        voteGiftIds: [...loop.keys()],
        krampusIds: [],
        krampusScore: null,
        revealedKrampus: false,
        scene: "voting",
        sceneStartedAt: new Date(),
      },
      tx,
    );
  });
  notify();
}

/**
 * The admin ends the round: the one Krampus is decided, or, while gifts still
 * tie, the next tie-break round opens right away. Rounds never end on the last
 * vote: everyone can keep changing their rating until the admin closes the
 * round. A round nobody has rated yet can't be closed; it simply stays open.
 */
export function closeRound() {
  db.transaction((tx) => {
    const state = getState(tx);
    if (state.voteStatus !== "open") throw new UserError(tr().noRoundOpen, 409);
    const ctx = roundContext(tx);
    const outcome = decide(ctx, roundVotes(ctx.round, tx));
    if (outcome.kind === "no-ratings") throw new UserError(tr().nothingRatedYet, 409);
    if (outcome.kind === "done") {
      patchState({ voteStatus: "done", krampusIds: outcome.krampusIds, krampusScore: outcome.score }, tx);
    } else {
      patchState({ voteRound: outcome.round, voteGiftIds: outcome.gifts }, tx);
    }
  });
  notify();
}

/** Records `voterId`'s rating of the gift received by `forId`. */
export function castVote(voterId: string, forId: unknown, score: unknown) {
  if (typeof forId !== "string") throw new UserError(tr().whichGift);
  if (typeof score !== "number" || !Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
    throw new UserError(tr().badScore(MIN_SCORE, MAX_SCORE));
  }
  db.transaction((tx) => {
    const state = getState(tx);
    if (state.voteStatus !== "open") throw new UserError(tr().votingClosed, 409);
    const ctx = roundContext(tx);
    const gift = [...ctx.receiverOf].find(([, r]) => r === forId)?.[0];
    if (!gift || !ctx.gifts.includes(gift)) throw new UserError(tr().giftNotInRound, 404);
    if (!votersFor(ctx, gift).includes(voterId)) throw new UserError(tr().noVoteOnGift, 403);
    tx.insert(giftVote)
      .values({ round: ctx.round, voterId, giftGiverId: gift, score, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [giftVote.round, giftVote.voterId, giftVote.giftGiverId],
        set: { score, updatedAt: new Date() },
      })
      .run();
  });
  notify();
}

export function resetVoting() {
  db.transaction((tx) => {
    tx.delete(giftVote).run();
    const state = getState(tx);
    patchState(
      {
        voteRound: 0,
        voteStatus: "closed",
        voteGiftIds: [],
        krampusIds: [],
        krampusScore: null,
        revealedKrampus: false,
        ...(state.scene === "krampus" || state.scene === "voting"
          ? { scene: "title" as const, sceneStartedAt: new Date() }
          : {}),
      },
      tx,
    );
  });
  notify();
}

/** The current user's vote in this round for `gift`, if any. */
export function myScore(round: number, voterId: string, gift: string): number | null {
  return (
    db
      .select({ score: giftVote.score })
      .from(giftVote)
      .where(and(eq(giftVote.round, round), eq(giftVote.voterId, voterId), eq(giftVote.giftGiverId, gift)))
      .get()?.score ?? null
  );
}
