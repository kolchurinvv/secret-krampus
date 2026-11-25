import { describe, expect, test } from "bun:test";
import { assignPending, isSingleLoop, randomLoop, removeFromLoop, type Loop } from "./draw";

const ids = (n: number, prefix = "p") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("randomLoop", () => {
  test("is always one single cycle with no self-gifts (n = 3..50)", () => {
    for (let n = 3; n <= 50; n++) {
      for (let run = 0; run < 40; run++) {
        const loop = randomLoop(ids(n));
        expect(loop.size).toBe(n);
        for (const [g, r] of loop) expect(g).not.toBe(r);
        expect(isSingleLoop(loop)).toBe(true);
      }
    }
  });

  test("needs at least 3 people", () => {
    expect(() => randomLoop(ids(2))).toThrow(/at least 3/);
  });

  test("covers every cyclic order of 4 people", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const loop = randomLoop(ids(4));
      seen.add(ids(4).map((g) => loop.get(g)).join());
    }
    expect(seen.size).toBe(6); // (4-1)! single cycles
  });
});

describe("assignPending", () => {
  test("first press draws everyone", () => {
    const r = assignPending(new Map(), ids(6));
    expect(r.newGivers.length).toBe(6);
    expect(r.changedGivers).toEqual([]);
    expect(isSingleLoop(r.loop)).toBe(true);
  });

  test("late joiners are spliced in; exactly one existing giver changes per press", () => {
    for (let k = 1; k <= 5; k++) {
      for (let run = 0; run < 50; run++) {
        const base = randomLoop(ids(6));
        const pool = [...ids(6), ...ids(k, "late")];
        const r = assignPending(base, pool);
        expect(r.loop.size).toBe(6 + k);
        expect(isSingleLoop(r.loop)).toBe(true);
        expect(r.newGivers.sort()).toEqual(ids(k, "late").sort());
        expect(r.changedGivers.length).toBe(1);
        const changed = [...base.keys()].filter((g) => base.get(g) !== r.loop.get(g));
        expect(changed).toEqual(r.changedGivers);
      }
    }
  });

  test("the admin can choose whose match changes", () => {
    const base = randomLoop(ids(5));
    const r = assignPending(base, [...ids(5), "late0"], { preferredGiver: "p3" });
    expect(r.changedGivers).toEqual(["p3"]);
    expect(r.loop.get("p3")).toBe("late0");
    expect(r.loop.get("late0")).toBe(base.get("p3"));
  });

  test("nothing to do when everyone is assigned", () => {
    const base = randomLoop(ids(4));
    const r = assignPending(base, ids(4));
    expect(r.newGivers).toEqual([]);
    expect(r.changedGivers).toEqual([]);
  });

  test("refuses a loop with people no longer in the pool", () => {
    expect(() => assignPending(randomLoop(ids(4)), ids(3))).toThrow(/stale/);
  });
});

describe("removeFromLoop", () => {
  test("their giver inherits their receiver and the loop stays single", () => {
    for (let run = 0; run < 100; run++) {
      const base = randomLoop(ids(7));
      const giver = [...base].find(([, r]) => r === "p2")![0];
      const r = removeFromLoop(base, "p2");
      expect(r.loop.has("p2")).toBe(false);
      expect(r.changedGivers).toEqual([giver]);
      expect(r.loop.get(giver)).toBe(base.get("p2"));
      expect(isSingleLoop(r.loop)).toBe(true);
    }
  });

  test("clears the loop when fewer than two would remain", () => {
    const two: Loop = new Map([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(removeFromLoop(two, "a").loop.size).toBe(0);
  });

  test("ignores people who aren't in the loop", () => {
    const base = randomLoop(ids(3));
    expect(removeFromLoop(base, "nobody").changedGivers).toEqual([]);
  });
});
