// Pure Secret Santa assignment logic. A "loop" maps giver → receiver, and all
// entries together always form ONE cycle: nobody draws themselves, and no two
// people just swap gifts (unless only two people are left).

export type Loop = Map<string, string>;
export type Rand = (n: number) => number; // uniform integer in [0, n)

export const cryptoRand: Rand = (n) => {
  if (n <= 0) throw new Error("rand range must be positive");
  // Rejection sampling keeps the result unbiased.
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % n;
  }
};

export const MIN_DRAW = 3;

export function shuffle<T>(items: readonly T[], rand: Rand = cryptoRand): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * A uniformly random single cycle over `ids`: shuffle, then everyone gives to
 * the next person in the shuffled order (equivalent to Sattolo's algorithm).
 */
export function randomLoop(ids: readonly string[], rand: Rand = cryptoRand): Loop {
  if (new Set(ids).size !== ids.length) throw new Error("duplicate participant ids");
  if (ids.length < MIN_DRAW) throw new Error(`Need at least ${MIN_DRAW} people in the Secret Santa to draw`);
  const order = shuffle(ids, rand);
  const loop: Loop = new Map();
  order.forEach((id, i) => loop.set(id, order[(i + 1) % order.length]!));
  return loop;
}

export type AssignResult = {
  loop: Loop;
  /** Givers who had no assignment before. */
  newGivers: string[];
  /** Existing givers whose receiver changed. */
  changedGivers: string[];
};

/**
 * Assigns everyone in `pool` who isn't in `current` yet.
 *  - No loop yet → a fresh random loop over the whole pool.
 *  - Otherwise the newcomers are spliced in as one chain at a single point:
 *    A→B becomes A→N1→N2→…→Nk→B. Only A's match changes, however many people
 *    joined. A is `preferredGiver` if given (and valid), else random.
 * Members of `current` that are no longer in `pool` must be removed first
 * (see removeFromLoop); this function refuses to work on a stale loop.
 */
export function assignPending(
  current: Loop,
  pool: readonly string[],
  opts: { preferredGiver?: string | null; rand?: Rand } = {},
): AssignResult {
  const rand = opts.rand ?? cryptoRand;
  const poolSet = new Set(pool);
  for (const giver of current.keys()) {
    if (!poolSet.has(giver)) throw new Error(`stale loop: ${giver} is not in the pool`);
  }

  if (current.size === 0) {
    const loop = randomLoop(pool, rand);
    return { loop, newGivers: [...loop.keys()], changedGivers: [] };
  }

  const newcomers = shuffle(
    pool.filter((id) => !current.has(id)),
    rand,
  );
  if (newcomers.length === 0) return { loop: new Map(current), newGivers: [], changedGivers: [] };

  const givers = [...current.keys()];
  const a =
    opts.preferredGiver && current.has(opts.preferredGiver) ? opts.preferredGiver : givers[rand(givers.length)]!;
  const b = current.get(a)!;

  const loop: Loop = new Map(current);
  loop.set(a, newcomers[0]!);
  newcomers.forEach((n, i) => loop.set(n, newcomers[i + 1] ?? b));
  return { loop, newGivers: newcomers, changedGivers: [a] };
}

export type RemoveResult = { loop: Loop; changedGivers: string[] };

/**
 * Takes `id` out of the loop: their giver G takes over their receiver R
 * (G→X→R becomes G→R). If fewer than two people would remain, nobody can give
 * to anybody, so the loop is cleared.
 */
export function removeFromLoop(current: Loop, id: string): RemoveResult {
  if (!current.has(id)) return { loop: new Map(current), changedGivers: [] };
  if (current.size - 1 < 2) return { loop: new Map(), changedGivers: [] };
  const receiver = current.get(id)!;
  const giver = [...current.entries()].find(([, r]) => r === id)?.[0];
  const loop: Loop = new Map(current);
  loop.delete(id);
  if (!giver) throw new Error("broken loop: nobody gives to " + id);
  loop.set(giver, receiver);
  return { loop, changedGivers: [giver] };
}

/** True if `loop` is a single cycle covering all its keys with no self-gifts. */
export function isSingleLoop(loop: Loop): boolean {
  if (loop.size === 0) return true;
  const receivers = new Set(loop.values());
  if (receivers.size !== loop.size) return false;
  for (const r of receivers) if (!loop.has(r)) return false;
  const start = loop.keys().next().value as string;
  let cur = start;
  for (let i = 0; i < loop.size; i++) {
    const next = loop.get(cur)!;
    if (next === cur) return false;
    cur = next;
    if (cur === start && i < loop.size - 1) return false;
  }
  return cur === start;
}
