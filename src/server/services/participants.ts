import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { participant, user } from "../db/schema";
import { UserError } from "../errors";
import { notify } from "../events";
import { removeFromPool } from "./santa";
import { deleteAvatar } from "./storage";
import { tr } from "../messages";

export type Participant = typeof participant.$inferSelect;

const NAME_MAX = 40;
const WISHLIST_MAX = 1000;

export function cleanName(name: unknown): string {
  if (typeof name !== "string") throw new UserError(tr().nameNotText);
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw new UserError(tr().nameEmpty);
  if (n.length > NAME_MAX) throw new UserError(tr().nameTooLong(NAME_MAX));
  return n;
}

function cleanEmail(email: unknown): string | null {
  if (email === null || email === undefined || email === "") return null;
  if (typeof email !== "string") throw new UserError(tr().emailNotText);
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new UserError(tr().emailInvalid);
  return e;
}

export function getParticipant(id: string) {
  return db.select().from(participant).where(eq(participant.id, id)).get();
}

/**
 * Finds the participant for a signed-in user, linking an admin-created person
 * with the same email or creating a new one. Called on sign-up and as a
 * fallback whenever a signed-in user has no participant.
 */
export function ensureParticipantForUser(u: { id: string; email: string; name?: string | null }): Participant {
  const existing = db.select().from(participant).where(eq(participant.userId, u.id)).get();
  if (existing) return existing;
  const email = u.email.toLowerCase();
  const name = (u.name ?? "").trim().slice(0, NAME_MAX);
  const result = db.transaction((tx) => {
    const unlinked = tx
      .select()
      .from(participant)
      .where(and(eq(participant.email, email), isNull(participant.userId)))
      .get();
    if (unlinked) {
      tx.update(participant)
        .set({ userId: u.id, name: unlinked.name || name })
        .where(eq(participant.id, unlinked.id))
        .run();
      return { ...unlinked, userId: u.id, name: unlinked.name || name };
    }
    return tx.insert(participant).values({ userId: u.id, email, name }).returning().get();
  });
  notify();
  return result;
}

export function createPerson(input: { name: unknown; email?: unknown }) {
  const name = cleanName(input.name);
  const email = cleanEmail(input.email);
  if (email && db.select().from(participant).where(eq(participant.email, email)).get()) {
    throw new UserError(tr().emailTaken, 409);
  }
  const p = db.insert(participant).values({ name, email }).returning().get();
  notify();
  return p;
}

export function updatePerson(id: string, input: { name?: unknown; email?: unknown; inSanta?: unknown; wishlist?: unknown }) {
  const p = getParticipant(id);
  if (!p) throw new UserError(tr().noSuchPerson, 404);
  const patch: Partial<Participant> = {};
  if (input.name !== undefined) patch.name = cleanName(input.name);
  if (input.wishlist !== undefined) {
    if (typeof input.wishlist !== "string") throw new UserError(tr().wishlistNotText);
    patch.wishlist = input.wishlist.trim().slice(0, WISHLIST_MAX);
  }
  if (input.email !== undefined) {
    if (p.userId) throw new UserError(tr().emailLocked);
    const email = cleanEmail(input.email);
    if (email && email !== p.email && db.select().from(participant).where(eq(participant.email, email)).get()) {
      throw new UserError(tr().emailTaken, 409);
    }
    patch.email = email;
  }
  if (input.inSanta !== undefined) {
    if (typeof input.inSanta !== "boolean") throw new UserError(tr().inSantaNotBool);
    patch.inSanta = input.inSanta;
  }
  db.transaction((tx) => {
    if (patch.inSanta === false && p.inSanta) removeFromPool(tx, id);
    tx.update(participant).set(patch).where(eq(participant.id, id)).run();
    if (patch.name && p.userId) tx.update(user).set({ name: patch.name }).where(eq(user.id, p.userId)).run();
  });
  notify();
}

export async function deletePerson(id: string) {
  const p = getParticipant(id);
  if (!p) throw new UserError(tr().noSuchPerson, 404);
  db.transaction((tx) => {
    removeFromPool(tx, id);
    tx.delete(participant).where(eq(participant.id, id)).run();
    // Their login goes too; signing up again starts fresh.
    if (p.userId) tx.delete(user).where(eq(user.id, p.userId)).run();
  });
  await deleteAvatar(p.avatarKey);
  notify();
}

export async function setAvatar(id: string, avatar: { key: string; url: string }) {
  const p = getParticipant(id);
  if (!p) throw new UserError(tr().noSuchPerson, 404);
  db.update(participant).set({ avatarKey: avatar.key, avatarUrl: avatar.url }).where(eq(participant.id, id)).run();
  await deleteAvatar(p.avatarKey);
  notify();
}
