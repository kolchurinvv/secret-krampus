// Contest stars. One row per star; a person's score is their row count.
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, type DB } from "../db";
import { contest, participant, star } from "../db/schema";
import type { ContestKind } from "../../shared/types";
import { UserError } from "../errors";
import { notify } from "../events";
import { getState, patchState } from "./state";
import { tr } from "../messages";

export function starCounts(q: Pick<DB, "select"> = db): Map<string, number> {
  return new Map(
    q
      .select({ id: star.participantId, n: sql<number>`count(*)` })
      .from(star)
      .groupBy(star.participantId)
      .all()
      .map((r) => [r.id, Number(r.n)]),
  );
}

/** contestId → participantId → stars won in that contest. */
export function contestStarCounts(q: Pick<DB, "select"> = db): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const r of q
    .select({ contestId: star.contestId, participantId: star.participantId, n: sql<number>`count(*)` })
    .from(star)
    .where(isNotNull(star.contestId))
    .groupBy(star.contestId, star.participantId)
    .all()) {
    const m = out.get(r.contestId!) ?? new Map<string, number>();
    m.set(r.participantId, Number(r.n));
    out.set(r.contestId!, m);
  }
  return out;
}

function existingIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select({ id: participant.id }).from(participant).where(inArray(participant.id, ids)).all().map((r) => r.id);
}

function checkContest(contestId: unknown): string | null {
  if (contestId === undefined || contestId === null || contestId === "") return null;
  if (typeof contestId !== "string" || !db.select().from(contest).where(eq(contest.id, contestId)).get()) {
    throw new UserError(tr().noSuchContest, 404);
  }
  return contestId;
}

/**
 * +1 star to each of `ids`, as one undoable batch. `contestId` omitted →
 * the current contest; null → no contest.
 */
export function award(ids: unknown, contestId?: unknown) {
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === "string")) {
    throw new UserError(tr().pickSomeone);
  }
  const valid = existingIds([...new Set(ids as string[])]);
  if (valid.length === 0) throw new UserError(tr().nobodyExists, 404);
  const cid = contestId === undefined ? getState().currentContestId : checkContest(contestId);
  const batch = crypto.randomUUID();
  const now = new Date();
  db.insert(star)
    .values(valid.map((participantId) => ({ participantId, contestId: cid, awardBatchId: batch, createdAt: now })))
    .run();
  notify();
  return { batchId: batch, awarded: valid.length };
}

/** −1 star: removes that person's most recent star. */
export function removeOne(participantId: unknown) {
  if (typeof participantId !== "string") throw new UserError(tr().who);
  const last = db
    .select({ id: star.id })
    .from(star)
    .where(eq(star.participantId, participantId))
    .orderBy(desc(star.id))
    .get();
  if (!last) throw new UserError(tr().noStarsToTake);
  db.delete(star).where(eq(star.id, last.id)).run();
  notify();
}

/**
 * −1 star for each of `ids` who has one, to fix a mistaken award. With a
 * `contestId` only stars won in that contest count (so a contest can be
 * zeroed out and then deleted); otherwise their most recent star of any kind.
 * People with nothing to remove are skipped.
 */
export function removeFromEach(ids: unknown, contestId?: unknown) {
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === "string")) {
    throw new UserError(tr().pickSomeone);
  }
  const cid = contestId === undefined || contestId === null ? null : checkContest(contestId);
  const unique = [...new Set(ids as string[])];
  const drop = unique.flatMap((participantId) => {
    const last = db
      .select({ id: star.id })
      .from(star)
      .where(cid ? and(eq(star.participantId, participantId), eq(star.contestId, cid)) : eq(star.participantId, participantId))
      .orderBy(desc(star.id))
      .get();
    return last ? [last.id] : [];
  });
  if (drop.length === 0) {
    throw new UserError(cid ? tr().noStarsInContest : tr().noneHaveStars);
  }
  db.delete(star).where(inArray(star.id, drop)).run();
  notify();
  return { removed: drop.length, skipped: unique.length - drop.length };
}

export function lastBatch() {
  const row = db.select({ batch: star.awardBatchId }).from(star).orderBy(desc(star.id)).get();
  if (!row) return null;
  const rows = db
    .select({ participantId: star.participantId, at: star.createdAt, contestName: contest.name })
    .from(star)
    .leftJoin(contest, eq(star.contestId, contest.id))
    .where(eq(star.awardBatchId, row.batch))
    .all();
  return {
    batchId: row.batch,
    at: Math.max(...rows.map((r) => r.at.getTime())),
    contestName: rows[0]?.contestName ?? null,
    participantIds: rows.map((r) => r.participantId),
  };
}

/** Removes the most recent award batch entirely. */
export function undoLast() {
  const b = lastBatch();
  if (!b) throw new UserError(tr().nothingToUndo);
  db.delete(star).where(eq(star.awardBatchId, b.batchId)).run();
  notify();
}

/** Sets someone's star count directly (adds or removes their newest stars). */
export function setCount(participantId: unknown, count: unknown) {
  if (typeof participantId !== "string" || existingIds([participantId]).length === 0) {
    throw new UserError(tr().noSuchPerson, 404);
  }
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > 999) {
    throw new UserError(tr().badStarCount);
  }
  const current = starCounts().get(participantId) ?? 0;
  if (count > current) {
    const batch = crypto.randomUUID();
    const now = new Date();
    db.insert(star)
      .values(Array.from({ length: count - current }, () => ({ participantId, awardBatchId: batch, createdAt: now })))
      .run();
  } else if (count < current) {
    const drop = db
      .select({ id: star.id })
      .from(star)
      .where(eq(star.participantId, participantId))
      .orderBy(desc(star.id))
      .limit(current - count)
      .all()
      .map((r) => r.id);
    db.delete(star).where(inArray(star.id, drop)).run();
  }
  notify();
}

/** The people with the most stars (empty if nobody has any). */
export function leaders(): { stars: number; ids: string[] } {
  const counts = starCounts();
  const max = Math.max(0, ...counts.values());
  if (max === 0) return { stars: 0, ids: [] };
  return { stars: max, ids: [...counts].filter(([, n]) => n === max).map(([id]) => id) };
}

export function createContest(name: unknown, kind: unknown) {
  if (typeof name !== "string" || !name.trim()) throw new UserError(tr().nameTheContest);
  if (kind !== "individual" && kind !== "team") throw new UserError(tr().badContestKind);
  const c = db
    .insert(contest)
    .values({ name: name.trim().slice(0, 60), kind: kind as ContestKind })
    .returning()
    .get();
  patchState({ currentContestId: c.id });
  notify();
  return c;
}

/** Only a contest nobody has a star in can go — as if it never happened. */
export function deleteContest(id: string) {
  const c = db.select().from(contest).where(eq(contest.id, id)).get();
  if (!c) throw new UserError(tr().noSuchContest, 404);
  const n = db.select({ n: sql<number>`count(*)` }).from(star).where(eq(star.contestId, id)).get()?.n ?? 0;
  if (Number(n) > 0) {
    throw new UserError(tr().contestHasStars(c.name, Number(n)), 409);
  }
  db.delete(contest).where(eq(contest.id, id)).run();
  notify();
}

export function setCurrentContest(id: unknown) {
  patchState({ currentContestId: checkContest(id) });
  notify();
}
