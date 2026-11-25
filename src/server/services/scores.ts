// Contest stars. One row per star; a person's score is their row count.
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, type DB } from "../db";
import { contest, participant, star } from "../db/schema";
import type { ContestKind } from "../../shared/types";
import { UserError } from "../errors";
import { notify } from "../events";
import { getState, patchState } from "./state";

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

function existingIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select({ id: participant.id }).from(participant).where(inArray(participant.id, ids)).all().map((r) => r.id);
}

function checkContest(contestId: unknown): string | null {
  if (contestId === undefined || contestId === null || contestId === "") return null;
  if (typeof contestId !== "string" || !db.select().from(contest).where(eq(contest.id, contestId)).get()) {
    throw new UserError("No such contest.", 404);
  }
  return contestId;
}

/**
 * +1 star to each of `ids`, as one undoable batch. `contestId` omitted →
 * the current contest; null → no contest.
 */
export function award(ids: unknown, contestId?: unknown) {
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === "string")) {
    throw new UserError("Pick at least one person.");
  }
  const valid = existingIds([...new Set(ids as string[])]);
  if (valid.length === 0) throw new UserError("None of those people exist.", 404);
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
  if (typeof participantId !== "string") throw new UserError("Who?");
  const last = db
    .select({ id: star.id })
    .from(star)
    .where(eq(star.participantId, participantId))
    .orderBy(desc(star.id))
    .get();
  if (!last) throw new UserError("They have no stars to take away.");
  db.delete(star).where(eq(star.id, last.id)).run();
  notify();
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
  if (!b) throw new UserError("Nothing to undo.");
  db.delete(star).where(eq(star.awardBatchId, b.batchId)).run();
  notify();
}

/** Sets someone's star count directly (adds or removes their newest stars). */
export function setCount(participantId: unknown, count: unknown) {
  if (typeof participantId !== "string" || existingIds([participantId]).length === 0) {
    throw new UserError("No such person.", 404);
  }
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > 999) {
    throw new UserError("Stars must be a whole number from 0 to 999.");
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
  if (typeof name !== "string" || !name.trim()) throw new UserError("Give the contest a name.");
  if (kind !== "individual" && kind !== "team") throw new UserError("Kind must be individual or team.");
  const c = db
    .insert(contest)
    .values({ name: name.trim().slice(0, 60), kind: kind as ContestKind })
    .returning()
    .get();
  patchState({ currentContestId: c.id });
  notify();
  return c;
}

export function deleteContest(id: string) {
  db.delete(contest).where(eq(contest.id, id)).run();
  notify();
}

export function setCurrentContest(id: unknown) {
  patchState({ currentContestId: checkContest(id) });
  notify();
}
