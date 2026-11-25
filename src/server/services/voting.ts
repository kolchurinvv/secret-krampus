// Krampus voting persistence; the rules are in krampus.ts.
import { and, eq, isNotNull } from "drizzle-orm";
import { db, type DB } from "../db";
import { giftVote, participant } from "../db/schema";
import { MAX_SCORE, MIN_SCORE } from "../../shared/types";
import { UserError } from "../errors";
import { notify } from "../events";
import { decide, isRoundComplete, votersFor, type RoundContext, type Vote } from "./krampus";
import { loadLoop } from "./santa";
import { getState, patchState } from "./state";

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
    if (state.voteRound > 0) throw new UserError("Voting has already started. Reset it to start over.", 409);
    const loop = loadLoop(tx);
    if (loop.size < 2) throw new UserError("Assign the Secret Santa first.");
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

/** Closes the round if it's complete (or `force`), then opens the tie-break or finishes. */
export function advance(force = false) {
  const changed = db.transaction((tx) => {
    const state = getState(tx);
    if (state.voteStatus !== "open") {
      if (force) throw new UserError("No voting round is open.", 409);
      return false;
    }
    const ctx = roundContext(tx);
    const votes = roundVotes(ctx.round, tx);
    if (!force && !isRoundComplete(ctx, votes)) return false;
    const outcome = decide(ctx, votes);
    if (outcome.kind === "done") {
      patchState({ voteStatus: "done", krampusIds: outcome.krampusIds, krampusScore: outcome.score }, tx);
    } else {
      patchState({ voteRound: outcome.round, voteGiftIds: outcome.gifts, voteStatus: "open" }, tx);
    }
    return true;
  });
  if (changed) {
    notify();
    // A tie-break round can be complete the moment it opens (e.g. nobody is
    // eligible); settle it right away instead of waiting forever.
    if (getState().voteStatus === "open") advance(false);
  }
}

export function closeRound() {
  advance(true);
}

/** Records `voterId`'s rating of the gift received by `forId`. */
export function castVote(voterId: string, forId: unknown, score: unknown) {
  if (typeof forId !== "string") throw new UserError("Which gift?");
  if (typeof score !== "number" || !Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
    throw new UserError(`Score must be a whole number from ${MIN_SCORE} to ${MAX_SCORE}.`);
  }
  db.transaction((tx) => {
    const state = getState(tx);
    if (state.voteStatus !== "open") throw new UserError("Voting isn't open right now.", 409);
    const ctx = roundContext(tx);
    const gift = [...ctx.receiverOf].find(([, r]) => r === forId)?.[0];
    if (!gift || !ctx.gifts.includes(gift)) throw new UserError("That gift isn't being rated this round.", 404);
    if (!votersFor(ctx, gift).includes(voterId)) throw new UserError("You don't get a vote on that gift this round.", 403);
    tx.insert(giftVote)
      .values({ round: ctx.round, voterId, giftGiverId: gift, score, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [giftVote.round, giftVote.voterId, giftVote.giftGiverId],
        set: { score, updatedAt: new Date() },
      })
      .run();
  });
  notify();
  advance(false);
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
