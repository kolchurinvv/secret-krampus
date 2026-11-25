// Builds the three views the browser can see. This file is the privacy
// boundary: read the comments in src/shared/types.ts before adding fields.
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { contest, participant, user } from "../db/schema";
import type { AdminState, MeState, PublicGift, PublicState } from "../../shared/types";
import { env } from "../env";
import { currentVersion } from "../events";
import { emailMode } from "./email";
import { giftsFor, hasVotedAll, roundVoters, type RoundContext } from "./krampus";
import { loadRows } from "./santa";
import { contestStarCounts, lastBatch, leaders, starCounts } from "./scores";
import { getState } from "./state";
import { roundContext, roundVotes } from "./voting";
import { storageMode } from "./storage";
import { tr } from "../messages";

const displayName = (name: string) => name || tr().mysteryElf;

function people() {
  return db
    .select({
      id: participant.id,
      name: participant.name,
      email: participant.email,
      userEmail: user.email,
      userId: participant.userId,
      avatarUrl: participant.avatarUrl,
      wishlist: participant.wishlist,
      inSanta: participant.inSanta,
      createdAt: participant.createdAt,
    })
    .from(participant)
    .leftJoin(user, eq(participant.userId, user.id))
    .orderBy(asc(participant.createdAt))
    .all();
}

function votingInfo(ctx: RoundContext, status: string) {
  const votes = ctx.round > 0 ? roundVotes(ctx.round) : [];
  const active = ctx.round > 0 && status === "open";
  const voters = active ? new Set(roundVoters(ctx)) : new Set<string>();
  const voted = new Set([...voters].filter((v) => hasVotedAll(ctx, votes, v)));
  return { votes, voters, voted };
}

export function buildPublicState(): PublicState {
  const state = getState();
  const all = people();
  const byId = new Map(all.map((p) => [p.id, p]));
  const stars = starCounts();
  const rows = loadRows();
  const ctx = roundContext();
  const { voters, voted } = votingInfo(ctx, state.voteStatus);
  const pool = all.filter((p) => p.inSanta).length;

  const gifts: PublicGift[] =
    state.voteRound > 0
      ? ctx.gifts.flatMap((g) => {
          const r = byId.get(ctx.receiverOf.get(g) ?? "");
          return r ? [{ forId: r.id, forName: displayName(r.name), forAvatarUrl: r.avatarUrl }] : [];
        })
      : [];

  const current = state.currentContestId
    ? db.select().from(contest).where(eq(contest.id, state.currentContestId)).get()
    : undefined;

  return {
    version: currentVersion(),
    serverNow: Date.now(),
    publicUrl: env.publicUrl,
    locale: state.locale,
    scene: { kind: state.scene, startedAt: state.sceneStartedAt.getTime(), message: state.sceneMessage },
    santa: { pool, assigned: rows.length, waiting: all.filter((p) => p.inSanta && !rows.some((r) => r.giverId === p.id)).length },
    participants: all.map((p) => ({
      id: p.id,
      name: displayName(p.name),
      avatarUrl: p.avatarUrl,
      stars: stars.get(p.id) ?? 0,
      inSanta: p.inSanta,
      canVote: voters.has(p.id),
      voted: voted.has(p.id),
      createdAt: p.createdAt.getTime(),
    })),
    voting: {
      round: state.voteRound,
      status: state.voteStatus,
      gifts,
      voters: voters.size,
      votedCount: voted.size,
    },
    contest: { current: current ? { id: current.id, name: current.name, kind: current.kind } : null },
    lastAward: lastBatch(),
    krampus: state.revealedKrampus
      ? {
          entries: state.krampusIds.map((id) => ({
            id,
            giftForName: displayName(byId.get(ctx.receiverOf.get(id) ?? "")?.name ?? ""),
            stars: state.krampusScore === null ? null : Math.round(state.krampusScore * 5) / 10,
          })),
        }
      : null,
    champion: state.revealedChampion ? { ids: state.championIds, stars: state.championStars } : null,
  };
}

export function buildMeState(participantId: string, email: string, isAdmin: boolean): MeState {
  const state = getState();
  const byId = new Map(people().map((p) => [p.id, p]));
  const me = byId.get(participantId)!;
  const mine = loadRows().find((r) => r.giverId === participantId);

  let match: MeState["match"];
  if (!me.inSanta) match = { state: "not-in-santa" };
  else if (!mine) match = { state: "waiting" };
  else {
    const r = byId.get(mine.receiverId)!;
    match = {
      state: "assigned",
      changed: mine.changed,
      assignedAt: mine.assignedAt.getTime(),
      receiver: { id: r.id, name: displayName(r.name), avatarUrl: r.avatarUrl, wishlist: r.wishlist },
    };
  }

  const tasks: MeState["voting"]["tasks"] = [];
  if (state.voteRound > 0) {
    const ctx = roundContext();
    const votes = roundVotes(ctx.round).filter((v) => v.voterId === participantId);
    for (const gift of giftsFor(ctx, participantId)) {
      const r = byId.get(ctx.receiverOf.get(gift) ?? "");
      if (!r) continue;
      tasks.push({
        forId: r.id,
        forName: displayName(r.name),
        forAvatarUrl: r.avatarUrl,
        isMine: r.id === participantId,
        score: votes.find((v) => v.giftGiverId === gift)?.score ?? null,
      });
    }
  }

  return {
    email,
    isAdmin,
    participant: { id: me.id, name: me.name, avatarUrl: me.avatarUrl, wishlist: me.wishlist, inSanta: me.inSanta },
    match,
    voting: { round: state.voteRound, status: state.voteStatus, tasks },
  };
}

export function buildAdminState(): AdminState {
  const state = getState();
  const all = people();
  const stars = starCounts();
  const rows = new Map(loadRows().map((r) => [r.giverId, r]));
  const ctx = roundContext();
  const { voters, voted } = votingInfo(ctx, state.voteStatus);
  const lead = leaders();
  const nameOf = new Map(all.map((p) => [p.id, displayName(p.name)]));
  const last = lastBatch();
  const byContest = contestStarCounts();
  const sum = (m: Map<string, number> | undefined) => [...(m ?? new Map<string, number>()).values()].reduce((a, b) => a + b, 0);

  return {
    people: all.map((p) => {
      const row = rows.get(p.id);
      return {
        id: p.id,
        name: p.name,
        email: p.userEmail ?? p.email,
        avatarUrl: p.avatarUrl,
        inSanta: p.inSanta,
        hasAccount: p.userId !== null,
        stars: stars.get(p.id) ?? 0,
        contestStars: Object.fromEntries(
          [...byContest].flatMap(([cid, m]) => (m.get(p.id) ? [[cid, m.get(p.id)!]] : [])),
        ),
        createdAt: p.createdAt.getTime(),
        santa: {
          assigned: !!row,
          changed: row?.changed ?? false,
          emailSentAt: row?.emailSentAt?.getTime() ?? null,
          emailError: row?.emailError ?? null,
        },
        voting: { canVote: voters.has(p.id), voted: voted.has(p.id) },
      };
    }),
    santa: {
      pool: all.filter((p) => p.inSanta).length,
      assigned: rows.size,
      waiting: all.filter((p) => p.inSanta && !rows.has(p.id)).length,
      pendingEmails: [...rows.values()].filter((r) => r.emailSentAt === null).length,
      drawDoneAt: state.drawDoneAt?.getTime() ?? null,
      locked: state.voteRound > 0,
    },
    voting: {
      round: state.voteRound,
      status: state.voteStatus,
      hasResult: state.voteStatus === "done",
      revealed: state.revealedKrampus,
    },
    contests: db
      .select()
      .from(contest)
      .orderBy(asc(contest.createdAt))
      .all()
      .map((c) => ({ id: c.id, name: c.name, kind: c.kind, createdAt: c.createdAt.getTime(), stars: sum(byContest.get(c.id)) })),
    currentContestId: state.currentContestId,
    lastAward: last
      ? { ...last, names: last.participantIds.map((id) => nameOf.get(id) ?? "?") }
      : null,
    scene: { kind: state.scene, startedAt: state.sceneStartedAt.getTime(), message: state.sceneMessage },
    leaders: { stars: lead.stars, names: lead.ids.map((id) => nameOf.get(id) ?? "?") },
    championRevealed: state.revealedChampion,
    emailMode,
    storageMode,
  };
}
