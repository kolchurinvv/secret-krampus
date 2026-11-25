import { eq } from "drizzle-orm";
import { db, type DB } from "../db";
import { appState } from "../db/schema";

type Tx = Pick<DB, "select" | "update">;
export type AppState = typeof appState.$inferSelect;

export function getState(tx: Tx = db): AppState {
  return tx.select().from(appState).where(eq(appState.id, 1)).get()!;
}

export function patchState(patch: Partial<Omit<AppState, "id">>, tx: Tx = db) {
  tx.update(appState).set(patch).where(eq(appState.id, 1)).run();
}
