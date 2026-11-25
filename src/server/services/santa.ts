// Secret Santa persistence: the loop lives in santa_assignment; the pure rules
// are in draw.ts. Every change runs in one transaction and ends with notify().
import { eq, inArray, isNull } from "drizzle-orm";
import { db, type DB } from "../db";
import { participant, santaAssignment, user } from "../db/schema";
import { UserError } from "../errors";
import { notify } from "../events";
import { assignPending, MIN_DRAW, randomLoop, removeFromLoop, type Loop } from "./draw";
import { sendAssignmentEmails, type AssignmentEmail } from "./email";
import { getState, patchState } from "./state";
import { tr } from "../messages";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type Row = typeof santaAssignment.$inferSelect;

export function loadRows(tx: Pick<DB, "select"> = db): Row[] {
  return tx.select().from(santaAssignment).all();
}

export function loadLoop(tx: Pick<DB, "select"> = db): Loop {
  return new Map(loadRows(tx).map((r) => [r.giverId, r.receiverId]));
}

export function poolIds(tx: Pick<DB, "select"> = db): string[] {
  return tx
    .select({ id: participant.id })
    .from(participant)
    .where(eq(participant.inSanta, true))
    .all()
    .map((r) => r.id);
}

export function assertSantaUnlocked(tx: Pick<DB, "select" | "update"> = db) {
  if (getState(tx).voteRound > 0) {
    throw new UserError(tr().santaLocked, 409);
  }
}

/**
 * Writes `after` over the current rows. Givers whose receiver is unchanged are
 * left alone (their email status survives). A giver who already got an email
 * (or was already flagged) is marked `changed`, so they get the "plot twist" mail.
 */
function saveLoop(tx: Tx, after: Loop) {
  const before = new Map(loadRows(tx).map((r) => [r.giverId, r]));
  const touched = [...before.keys()].filter((g) => before.get(g)!.receiverId !== after.get(g));
  const added = [...after.keys()].filter((g) => !before.has(g));
  const rewrite = [...touched, ...added];
  if (rewrite.length === 0) return;
  // Delete first, then insert, so the unique(receiver_id) constraint never
  // sees a half-updated loop.
  if (touched.length) tx.delete(santaAssignment).where(inArray(santaAssignment.giverId, touched)).run();
  const now = new Date();
  const inserts = rewrite
    .filter((g) => after.has(g))
    .map((g) => {
      const prev = before.get(g);
      return {
        giverId: g,
        receiverId: after.get(g)!,
        assignedAt: now,
        changed: prev ? prev.changed || prev.emailSentAt !== null : false,
        emailSentAt: null,
        emailError: null,
      };
    });
  if (inserts.length) tx.insert(santaAssignment).values(inserts).run();
}

/** First press: random loop over the pool. Later presses: splice in newcomers. */
export function assign(preferredGiverId?: string | null) {
  const result = db.transaction((tx) => {
    assertSantaUnlocked(tx);
    let loop = loadLoop(tx);
    const pool = poolIds(tx);
    // Defensive: drop anyone who left the pool without going through removeFromPool.
    for (const g of [...loop.keys()]) if (!pool.includes(g)) loop = removeFromLoop(loop, g).loop;
    if (loop.size === 0 && pool.length < MIN_DRAW) throw new UserError(tr().tooFewForDraw(MIN_DRAW));
    let res;
    try {
      res = assignPending(loop, pool, { preferredGiver: preferredGiverId });
    } catch (err) {
      throw new UserError((err as Error).message);
    }
    saveLoop(tx, res.loop);
    if (!getState(tx).drawDoneAt) patchState({ drawDoneAt: new Date() }, tx);
    return { newGivers: res.newGivers.length, changedGivers: res.changedGivers.length };
  });
  notify();
  return result;
}

/** Throws away every assignment and draws a fresh loop over the whole pool. */
export function reshuffle() {
  db.transaction((tx) => {
    assertSantaUnlocked(tx);
    const pool = poolIds(tx);
    if (pool.length < MIN_DRAW) throw new UserError(tr().tooFewForDraw(MIN_DRAW));
    let loop;
    try {
      loop = randomLoop(pool);
    } catch (err) {
      throw new UserError((err as Error).message);
    }
    // Every giver gets a new email; mark the ones who were already told something.
    const before = new Map(loadRows(tx).map((r) => [r.giverId, r]));
    tx.delete(santaAssignment).run();
    const now = new Date();
    tx.insert(santaAssignment)
      .values(
        [...loop].map(([g, r]) => {
          const prev = before.get(g);
          return {
            giverId: g,
            receiverId: r,
            assignedAt: now,
            changed: prev ? prev.changed || prev.emailSentAt !== null : false,
            emailSentAt: null,
            emailError: null,
          };
        }),
      )
      .run();
    patchState({ drawDoneAt: now }, tx);
  });
  notify();
}

/** Takes someone out of the loop (their giver inherits their receiver). Call inside a transaction. */
export function removeFromPool(tx: Tx, participantId: string) {
  const loop = loadLoop(tx);
  if (!loop.has(participantId)) return;
  assertSantaUnlocked(tx);
  saveLoop(tx, removeFromLoop(loop, participantId).loop);
}

/** Everything needed to email one giver about their match. */
function emailJobs(onlyGiver?: string): AssignmentEmail[] {
  const rows = loadRows().filter((r) => (onlyGiver ? r.giverId === onlyGiver : r.emailSentAt === null));
  if (rows.length === 0) return [];
  const people = new Map(
    db
      .select({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        wishlist: participant.wishlist,
        userEmail: user.email,
      })
      .from(participant)
      .leftJoin(user, eq(participant.userId, user.id))
      .all()
      .map((p) => [p.id, p]),
  );
  return rows.map((r) => {
    const giver = people.get(r.giverId)!;
    const receiver = people.get(r.receiverId)!;
    return {
      giverId: r.giverId,
      to: giver.userEmail ?? giver.email ?? null,
      giverName: giver.name,
      receiverName: receiver.name,
      receiverWishlist: receiver.wishlist,
      changed: r.changed,
    };
  });
}

async function deliver(jobs: AssignmentEmail[]) {
  const results = await sendAssignmentEmails(jobs);
  const now = new Date();
  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok) sent++;
    else failed++;
    db.update(santaAssignment)
      .set(r.ok ? { emailSentAt: now, emailError: null } : { emailError: r.error })
      .where(eq(santaAssignment.giverId, r.giverId))
      .run();
  }
  notify();
  return { sent, failed };
}

/** Emails every giver who hasn't been told about their current match. */
export function sendPending() {
  return deliver(emailJobs());
}

/** Re-sends one giver's email, whatever its status. */
export function resend(giverId: string) {
  const jobs = emailJobs(giverId);
  if (jobs.length === 0) throw new UserError(tr().noAssignment, 404);
  return deliver(jobs);
}

export function pendingEmailCount() {
  return db.select({ g: santaAssignment.giverId }).from(santaAssignment).where(isNull(santaAssignment.emailSentAt)).all()
    .length;
}

