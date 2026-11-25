import { createEffect, createSignal, onCleanup } from "solid-js";
import { useSceneActive } from "../scene-context";
import { play, type SfxHandle, type SfxName } from "../sfx";
import { elapsedSince } from "../util";

/**
 * A reveal timeline anchored to when the admin switched scenes, so every
 * screen (and a late joiner) agrees on where we are. A screen that joins after
 * `rejoinAfterMs` jumps straight to the final phase, silently.
 *
 * Everything it starts (timers, sounds, confetti) stops the moment the scene
 * begins to fade out, not when it finally unmounts.
 */
export function createRevealTimeline<P extends string>(opts: {
  startLocal: number;
  phases: { phase: P; at: number }[];
  finalPhase: P;
  rejoinAfterMs: number;
  sounds?: { at: number; name: SfxName; durationMs?: number }[];
  effects?: { at: number; run: () => (() => void) | void }[];
}) {
  const active = useSceneActive();
  const elapsed = elapsedSince(opts.startLocal);
  const rejoin = elapsed > opts.rejoinAfterMs;
  const initial = rejoin
    ? opts.finalPhase
    : ([...opts.phases].reverse().find((p) => p.at <= elapsed)?.phase ?? opts.phases[0]!.phase);
  const [phase, setPhase] = createSignal<P>(initial);
  let timers: ReturnType<typeof setTimeout>[] = [];
  let handles: SfxHandle[] = [];
  let stops: (() => void)[] = [];
  let stopped = false;

  const stopAll = () => {
    stopped = true;
    for (const t of timers) clearTimeout(t);
    for (const h of handles) h.stop();
    for (const s of stops) s();
    timers = [];
    handles = [];
    stops = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.push(
      setTimeout(
        () => {
          if (!stopped && active()) fn();
        },
        Math.max(0, ms),
      ),
    );
  };

  if (!rejoin) {
    for (const p of opts.phases) {
      if (p.at > elapsed) later(p.at - elapsed, () => setPhase(() => p.phase));
    }
    for (const s of opts.sounds ?? []) {
      // A drum roll that already started is joined for the remaining time.
      const remaining = s.durationMs !== undefined ? s.durationMs - Math.max(0, elapsed - s.at) : undefined;
      if (s.at < elapsed && (remaining === undefined || remaining < 400)) continue;
      later(s.at - elapsed, () => {
        const h = play(s.name, remaining !== undefined ? { durationMs: remaining } : {});
        if (h) handles.push(h);
      });
    }
    for (const e of opts.effects ?? []) {
      if (e.at < elapsed) continue;
      later(e.at - elapsed, () => {
        const stop = e.run();
        if (stop) stops.push(stop);
      });
    }
  }

  createEffect(() => {
    if (!active()) stopAll();
  });
  onCleanup(stopAll);

  return { phase, rejoined: rejoin };
}
