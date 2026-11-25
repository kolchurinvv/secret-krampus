import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { env } from "../env";
import * as schema from "./schema";

export function openDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true, strict: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA synchronous = NORMAL;");
  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: join(import.meta.dir, "migrations") });
  // The single app_state row always exists.
  sqlite
    .query("INSERT OR IGNORE INTO app_state (id, scene_started_at, locale) VALUES (1, ?, ?)")
    .run(Date.now(), env.defaultLocale);
  return { db, sqlite };
}

export const { db, sqlite } = openDatabase(env.databasePath);
export type DB = typeof db;
export { schema };
