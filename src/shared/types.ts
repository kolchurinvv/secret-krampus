// The contract between the Bun server and the Solid client. Everything the
// browser receives is one of these shapes; nothing else crosses the wire.
//
// Privacy rules baked into these types:
//  - PublicState is broadcast to anyone (the TV, phones, the admin). It never
//    carries emails, Secret Santa pairs, individual gift scores, or the Krampus
//    before it is revealed.
//  - Gifts are identified by their RECIPIENT ("Anna's gift" → forId = Anna's
//    participant id). The giver never appears until the Krampus reveal.
//  - AdminState shows delivery status per giver but never who they give to.

export const SCENES = ["title", "lobby", "voting", "leaderboard", "krampus", "champion"] as const;
export type SceneKind = (typeof SCENES)[number];

export type ContestKind = "individual" | "team";
export type VoteStatus = "closed" | "open" | "done";

/** A gift score is an integer 1..10; each step is half a star (score / 2 = stars). */
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

export type PublicParticipant = {
  id: string;
  name: string;
  avatarUrl: string | null;
  stars: number;
  inSanta: boolean;
  /** Eligible to vote in the current voting round. */
  canVote: boolean;
  /** Has cast every vote they owe in the current voting round. */
  voted: boolean;
  createdAt: number;
};

export type PublicGift = {
  /** Participant id of the gift's RECIPIENT. */
  forId: string;
  forName: string;
  forAvatarUrl: string | null;
};

export type PublicState = {
  /** Increments on every change; lets clients detect fresh snapshots. */
  version: number;
  /** Server clock (ms) when this snapshot was built — use to sync reveal timelines. */
  serverNow: number;
  /** Public origin, e.g. https://secretkrampus.party — for the lobby QR code. */
  publicUrl: string;
  scene: { kind: SceneKind; startedAt: number; message: string };
  santa: { pool: number; assigned: number; waiting: number };
  participants: PublicParticipant[];
  voting: {
    /** 0 = never opened. 1 = recipients rate their own gift. 2+ = tie-break, everyone rates. */
    round: number;
    status: VoteStatus;
    /** The gifts being rated this round (round 1: all of them; 2+: the tied ones). */
    gifts: PublicGift[];
    voters: number;
    votedCount: number;
  };
  contest: { current: { id: string; name: string; kind: ContestKind } | null };
  /** The most recent +1 batch — drives the "who just scored" banner. */
  lastAward: { batchId: string; at: number; contestName: string | null; participantIds: string[] } | null;
  /** Only present once the admin has revealed the Krampus on the TV. */
  krampus: {
    entries: { id: string; giftForName: string; stars: number | null }[];
  } | null;
  /** Only present once the admin has crowned the champion. */
  champion: { ids: string[]; stars: number } | null;
};

export type MeVoteTask = {
  forId: string;
  forName: string;
  forAvatarUrl: string | null;
  /** True for the gift the current user received. */
  isMine: boolean;
  /** Current user's score for this gift in this round (1..10), or null. */
  score: number | null;
};

export type MeState = {
  email: string;
  isAdmin: boolean;
  participant: {
    id: string;
    name: string;
    avatarUrl: string | null;
    wishlist: string;
    inSanta: boolean;
  };
  match:
    | { state: "not-in-santa" }
    | { state: "waiting" }
    | {
        state: "assigned";
        /** The match changed after the first draw (a late joiner was spliced in). */
        changed: boolean;
        assignedAt: number;
        receiver: { id: string; name: string; avatarUrl: string | null; wishlist: string };
      };
  voting: { round: number; status: VoteStatus; tasks: MeVoteTask[] };
};

export type AdminPerson = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  inSanta: boolean;
  hasAccount: boolean;
  stars: number;
  createdAt: number;
  santa: {
    /** Has a giver→receiver assignment (as giver). Never says to whom. */
    assigned: boolean;
    changed: boolean;
    emailSentAt: number | null;
    emailError: string | null;
  };
  voting: { canVote: boolean; voted: boolean };
};

export type AdminState = {
  people: AdminPerson[];
  santa: {
    pool: number;
    assigned: number;
    waiting: number;
    pendingEmails: number;
    drawDoneAt: number | null;
    /** Santa changes are blocked once Krampus voting has started. */
    locked: boolean;
  };
  voting: { round: number; status: VoteStatus; hasResult: boolean; revealed: boolean };
  contests: { id: string; name: string; kind: ContestKind; createdAt: number }[];
  currentContestId: string | null;
  lastAward: { batchId: string; at: number; contestName: string | null; names: string[] } | null;
  scene: { kind: SceneKind; startedAt: number; message: string };
  /** For the champion tie warning. */
  leaders: { stars: number; names: string[] };
  championRevealed: boolean;
  emailMode: "resend" | "console";
  storageMode: "r2" | "local";
};

/** Error body for every non-2xx JSON response. */
export type ApiError = { error: string };

/*
 * HTTP API (all JSON unless noted; mutations return { ok: true, ... }).
 * Clients refetch their private state when the SSE stream announces a change.
 *
 * Public
 *   GET  /api/live/state                      → PublicState
 *   GET  /api/live/stream                     → SSE: event "state" (PublicState JSON), event "ping"
 *   GET  /healthz                             → "ok"
 *
 * Auth (Better Auth, email OTP) — use the client in src/client/lib/auth-client.ts
 *   authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
 *   authClient.signIn.emailOtp({ email, otp, name? })   // name only used on first sign-up
 *   authClient.signOut()
 *
 * Signed-in user (401 if not signed in)
 *   GET   /api/me                             → MeState
 *   PATCH /api/me            { name?, wishlist? }
 *   POST  /api/me/avatar     multipart "file" (webp/jpeg/png, ≤ 2 MB) → { ok, avatarUrl }
 *   POST  /api/me/vote       { forId, score }   score 1..10
 *
 * Admin (403 unless email is in ADMIN_EMAILS)
 *   GET    /api/admin/state                   → AdminState
 *   POST   /api/admin/people                  { name, email? }
 *   PATCH  /api/admin/people/:id              { name?, email?, inSanta? }
 *   DELETE /api/admin/people/:id
 *   POST   /api/admin/people/:id/avatar       multipart "file"
 *   POST   /api/admin/santa/assign            { preferredGiverId?: string | null } → { ok, newGivers, changedGivers }
 *   POST   /api/admin/santa/reshuffle
 *   POST   /api/admin/santa/send-pending      → { ok, sent, failed }
 *   POST   /api/admin/santa/resend/:giverId
 *   POST   /api/admin/voting/open
 *   POST   /api/admin/voting/close-round
 *   POST   /api/admin/voting/reset
 *   POST   /api/admin/contests                { name, kind }
 *   DELETE /api/admin/contests/:id
 *   POST   /api/admin/contests/current        { id: string | null }
 *   POST   /api/admin/stars/award             { participantIds: string[], contestId?: string | null }  (omitted → current contest, null → none)
 *   POST   /api/admin/stars/remove-one        { participantId }
 *   POST   /api/admin/stars/undo-last
 *   POST   /api/admin/stars/set               { participantId, count }
 *   POST   /api/admin/scene                   { kind: SceneKind, message? }  (krampus needs voting done; champion crowns current leaders)
 *   POST   /api/admin/message                 { message }
 */
