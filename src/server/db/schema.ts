import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Locale } from "../../shared/i18n";
import type { ContestKind, SceneKind, VoteStatus } from "../../shared/types";

const now = () => new Date();
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

// ---------------------------------------------------------------------------
// Better Auth core tables (user / session / account / verification).
// ---------------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().$defaultFn(now),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(now),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(now),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// App tables.
// ---------------------------------------------------------------------------

/** A person shown in the app. May or may not have a login (userId). */
export const participant = sqliteTable("participant", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  /** Lower-cased. Lets an admin-created person be linked when they sign up. */
  email: text("email").unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  /** Storage key of the current avatar, so a replacement can delete it. */
  avatarKey: text("avatar_key"),
  wishlist: text("wishlist").notNull().default(""),
  inSanta: integer("in_santa", { mode: "boolean" }).notNull().default(true),
  createdAt: timestamp("created_at").notNull().$defaultFn(now),
});

/** giver → receiver. All rows together always form one single loop. */
export const santaAssignment = sqliteTable("santa_assignment", {
  giverId: text("giver_id")
    .primaryKey()
    .references(() => participant.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id")
    .notNull()
    .unique()
    .references(() => participant.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().$defaultFn(now),
  /** The giver's match changed after their first assignment → "plot twist" email. */
  changed: integer("changed", { mode: "boolean" }).notNull().default(false),
  emailSentAt: timestamp("email_sent_at"),
  emailError: text("email_error"),
});

/** One rating of one gift (identified by its giver) in one voting round. */
export const giftVote = sqliteTable(
  "gift_vote",
  {
    round: integer("round").notNull(),
    voterId: text("voter_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
    giftGiverId: text("gift_giver_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
    /** 1..10, each step half a star. */
    score: integer("score").notNull(),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.round, t.voterId, t.giftGiverId] })],
);

export const contest = sqliteTable("contest", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  kind: text("kind").$type<ContestKind>().notNull().default("individual"),
  createdAt: timestamp("created_at").notNull().$defaultFn(now),
});

/** One star = one win. A person's score is how many rows they have. */
export const star = sqliteTable(
  "star",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: text("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
    contestId: text("contest_id").references(() => contest.id, { onDelete: "set null" }),
    /** Stars given together share a batch, so a group award can be undone at once. */
    awardBatchId: text("award_batch_id").notNull(),
    createdAt: timestamp("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("star_participant_idx").on(t.participantId), index("star_batch_idx").on(t.awardBatchId)],
);

/** Single row (id = 1) holding the party's global state. */
export const appState = sqliteTable("app_state", {
  id: integer("id").primaryKey(),
  scene: text("scene").$type<SceneKind>().notNull().default("title"),
  sceneStartedAt: timestamp("scene_started_at").notNull().$defaultFn(now),
  sceneMessage: text("scene_message").notNull().default(""),
  drawDoneAt: timestamp("draw_done_at"),
  voteRound: integer("vote_round").notNull().default(0),
  voteStatus: text("vote_status").$type<VoteStatus>().notNull().default("closed"),
  /** Giver ids of the gifts rated in the current round. */
  voteGiftIds: text("vote_gift_ids", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  /** Giver ids of the Krampus (several on an unbreakable tie). */
  krampusIds: text("krampus_ids", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  /** Final score (1..10 scale, averaged) of the Krampus gift(s). */
  krampusScore: real("krampus_score"),
  revealedKrampus: integer("revealed_krampus", { mode: "boolean" }).notNull().default(false),
  championIds: text("champion_ids", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  championStars: integer("champion_stars").notNull().default(0),
  revealedChampion: integer("revealed_champion", { mode: "boolean" }).notNull().default(false),
  currentContestId: text("current_contest_id").references(() => contest.id, { onDelete: "set null" }),
  /** The language the whole app (and its emails) speaks; the admin toggles it. */
  locale: text("locale").$type<Locale>().notNull().default("ru"),
});
