// Development-only fake feed for the TV: /live?mock=1[&scene=leaderboard].
// Loaded with a dynamic import, so it never ships in the normal code path.
//
// Extra params: &vote=1|2|done, &ties=N (tied gifts in round 2),
// &then=scene@ms,... (scheduled scene switches).
// Keys: 1–6 switch scenes (title, lobby, voting, leaderboard, krampus,
// champion) · a = award stars now · n = new sign-up · v = advance voting ·
// r = replay the current scene · p = pause/resume auto awards.
import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { SCENES, type PublicParticipant, type PublicState, type SceneKind } from "../../shared/types";
import { boardOrder } from "./util";
import type { TvSource } from "./types";

const NAMES = [
  "Anna Nováková",
  "Boris",
  "Clara Svoboda",
  "Dmitri",
  "Eva",
  "Filip Dvořák",
  "Greta",
  "Hugo",
  "Ivana",
  "Jakub",
  "Kateřina",
  "Leo",
  "Marta",
  "Nikolai",
];
const EXTRA = ["Olga", "Pavel", "Quentin", "Radka", "Stefan", "Tereza", "Uma", "Viktor"];
const CONTESTS = ["Ugly sweater", "Carol karaoke", "Gingerbread build", "Charades", "Snowball toss"];
const EMOJI = ["🦌", "⛄", "🎅", "🧝", "🍪", "🐧", "🎄", "🔔"];

function fakeAvatar(name: string, i: number) {
  const hue = (i * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,30%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><text x="50" y="68" font-size="52" text-anchor="middle">${EMOJI[i % EMOJI.length]}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function person(name: string, i: number, createdAt: number): PublicParticipant {
  return {
    id: `p${i}`,
    name,
    avatarUrl: i % 3 === 1 ? null : fakeAvatar(name, i),
    stars: Math.floor(Math.random() * 4),
    inSanta: true,
    canVote: true,
    voted: false,
    createdAt,
  };
}

let state: PublicState;
let apply: (next: PublicState) => void = () => {};
let tieCount = 2;
const [paused, setPaused] = createSignal(false);
export { paused };

function commit() {
  state = { ...state, version: state.version + 1, serverNow: Date.now() };
  apply(structuredClone(state));
}

export function setScene(kind: SceneKind) {
  if (kind === "krampus") {
    const loser = state.participants[Math.floor(Math.random() * state.participants.length)]!;
    const other = state.participants.find((p) => p.id !== loser.id)!;
    state.krampus = { entries: [{ id: loser.id, giftForName: other.name, stars: 1.5 }] };
    state.voting = { ...state.voting, status: "done" };
  }
  if (kind === "champion") {
    const sorted = [...state.participants].sort(boardOrder);
    const top = sorted[0]!.stars;
    state.champion = { ids: sorted.filter((p) => p.stars === top).map((p) => p.id), stars: top };
  }
  state.scene = { kind, startedAt: Date.now(), message: kind === "title" ? "Dinner is served at 19:30 🍽️" : "" };
  commit();
}

export function award() {
  const n = 1 + Math.floor(Math.random() * 3);
  const picks = [...state.participants].sort(() => Math.random() - 0.5).slice(0, n);
  // Bias toward people lower down so overtakes happen.
  const low = [...state.participants].sort(boardOrder).slice(-4);
  if (Math.random() < 0.6 && low[0]) picks[0] = low[Math.floor(Math.random() * low.length)]!;
  const ids = new Set(picks.map((p) => p.id));
  state.participants = state.participants.map((p) => (ids.has(p.id) ? { ...p, stars: p.stars + 1 } : p));
  const contestName = CONTESTS[Math.floor(Math.random() * CONTESTS.length)]!;
  state.contest = { current: { id: contestName, name: contestName, kind: ids.size > 1 ? "team" : "individual" } };
  state.lastAward = { batchId: crypto.randomUUID(), at: Date.now(), contestName, participantIds: [...ids] };
  commit();
}

export function addPerson() {
  const i = state.participants.length;
  const name = EXTRA[(i - NAMES.length) % EXTRA.length] ?? `Elf ${i}`;
  state.participants = [...state.participants, { ...person(name, i, Date.now()), stars: 0 }];
  state.santa = { ...state.santa, pool: state.santa.pool + 1, waiting: state.santa.waiting + 1 };
  commit();
}

/** closed → round 1 (votes trickle in) → round 2 tie → done. */
export function advanceVoting() {
  const v = state.voting;
  const giftsFor = (ps: PublicParticipant[]) =>
    ps.map((p) => ({ forId: p.id, forName: p.name, forAvatarUrl: p.avatarUrl }));
  if (v.status !== "open") {
    state.participants = state.participants.map((p) => ({ ...p, voted: false, canVote: true }));
    state.voting = {
      round: 1,
      status: "open",
      gifts: giftsFor(state.participants),
      voters: state.participants.length,
      votedCount: 0,
    };
  } else if (v.round === 1) {
    state.participants = state.participants.map((p) => ({ ...p, voted: false }));
    state.voting = {
      round: 2,
      status: "open",
      gifts: giftsFor(state.participants.slice(2, 2 + tieCount)),
      voters: state.participants.length,
      votedCount: 0,
    };
  } else {
    state.voting = { ...v, status: "done" };
  }
  commit();
}

function voteTrickle() {
  if (state.voting.status !== "open") return;
  const pending = state.participants.filter((p) => p.canVote && !p.voted);
  const pick = pending[Math.floor(Math.random() * pending.length)];
  if (!pick) return;
  state.participants = state.participants.map((p) => (p.id === pick.id ? { ...p, voted: true } : p));
  state.voting = { ...state.voting, votedCount: state.voting.votedCount + 1 };
  commit();
}

export function replay() {
  setScene(state.scene.kind);
}

export function createMockSource(params: URLSearchParams): TvSource {
  const scene = params.get("scene");
  tieCount = Math.min(8, Math.max(2, Number(params.get("ties")) || 2));
  const now = Date.now();
  const kind = (SCENES as readonly string[]).includes(scene ?? "") ? (scene as SceneKind) : "leaderboard";
  state = {
    version: 1,
    serverNow: now,
    publicUrl: "https://secretkrampus.party",
    scene: { kind: "title", startedAt: now, message: "" },
    santa: { pool: NAMES.length, assigned: NAMES.length, waiting: 0 },
    participants: NAMES.map((n, i) => person(n, i, now - (NAMES.length - i) * 60_000)),
    voting: { round: 0, status: "closed", gifts: [], voters: 0, votedCount: 0 },
    contest: { current: null },
    lastAward: null,
    krampus: null,
    champion: null,
  };
  const [store, set] = createStore<{ data: PublicState | null }>({ data: null });
  // reconcile keeps object identity per participant id, like the live feed.
  apply = (next) => set("data", reconcile(next, { key: "id", merge: true }));
  // &vote=1|2|done jumps the voting state machine ahead (for screenshots).
  const vote = params.get("vote") ?? (kind === "voting" ? "1" : null);
  if (vote) {
    const steps = vote === "done" ? 3 : Number(vote) || 1;
    for (let i = 0; i < steps; i++) advanceVoting();
    for (let i = 0; i < 5; i++) voteTrickle();
  }
  setScene(kind);
  // &then=champion@7000,lobby@12000 switches scenes on a schedule (for screenshots).
  for (const step of (params.get("then") ?? "").split(",").filter(Boolean)) {
    const [next, at] = step.split("@");
    if ((SCENES as readonly string[]).includes(next ?? "")) setTimeout(() => setScene(next as SceneKind), Number(at) || 0);
  }

  setInterval(() => {
    if (paused()) return;
    if (state.scene.kind === "leaderboard") award();
    if (state.scene.kind === "voting") voteTrickle();
    if (state.scene.kind === "lobby" && Math.random() < 0.4) addPerson();
  }, 3500);

  window.addEventListener("keydown", (e) => {
    const idx = Number(e.key) - 1;
    if (idx >= 0 && idx < SCENES.length) return setScene(SCENES[idx]!);
    if (e.key === "a") award();
    if (e.key === "n") addPerson();
    if (e.key === "v") advanceVoting();
    if (e.key === "r") replay();
    if (e.key === "p") setPaused((p) => !p);
  });

  return {
    get data() {
      return store.data;
    },
    toLocal: (ms) => ms,
  };
}

export function MockHud() {
  return (
    <div class="tv-mock-hud">
      MOCK{paused() ? " (paused)" : ""} · 1–6 scenes · a award · n new · v voting · r replay · p pause
    </div>
  );
}
