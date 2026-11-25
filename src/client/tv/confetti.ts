// Full-screen confetti on one shared canvas. Two moods: a slow, sad rain of
// coal for the Krampus, and proper gold bursts for the champion.
import confetti from "canvas-confetti";

let fire: confetti.CreateTypes | null = null;
/** Every running emitter loop, so a scene change can stop them all. */
const loops = new Set<ReturnType<typeof setInterval>>();

function startLoop(tick: () => void, everyMs: number, durationMs: number): () => void {
  const end = Date.now() + durationMs;
  const id = setInterval(() => {
    if (Date.now() > end) return stop();
    tick();
  }, everyMs);
  loops.add(id);
  function stop() {
    clearInterval(id);
    loops.delete(id);
  }
  return stop;
}

/** Stops every emitter and wipes the particles already in flight. */
export function clearConfetti() {
  for (const id of loops) clearInterval(id);
  loops.clear();
  fire?.reset();
}

export function attachConfetti(canvas: HTMLCanvasElement) {
  // No worker: emoji shapes are bitmaps, which are simplest on the main thread.
  fire = confetti.create(canvas, { resize: true, useWorker: false });
  return () => {
    clearConfetti();
    fire = null;
  };
}

const COAL_SCALAR = 3.2;
const PARTY_SCALAR = 2.6;
let coalShapes: confetti.Shape[] | null = null;
let partyShapes: confetti.Shape[] | null = null;

const coal = () =>
  (coalShapes ??= ["🪨", "⚫", "🥀", "🧦"].map((text) => confetti.shapeFromText({ text, scalar: COAL_SCALAR })));
const party = () =>
  (partyShapes ??= ["🎺", "⭐", "🏆"].map((text) => confetti.shapeFromText({ text, scalar: PARTY_SCALAR })));

/** Lumps of coal and grey ash drifting down from the top. Returns a stop fn. */
export function coalRain(durationMs = 12000): () => void {
  const f = fire;
  if (!f) return () => {};
  return startLoop(
    () => {
    f({
      particleCount: 1,
      angle: 270,
      spread: 25,
      startVelocity: 3,
      gravity: 0.5,
      decay: 0.97,
      ticks: 900,
      drift: (Math.random() - 0.5) * 0.8,
      origin: { x: Math.random(), y: -0.08 },
      shapes: coal(),
      scalar: COAL_SCALAR,
      flat: true,
      disableForReducedMotion: true,
    });
    f({
      particleCount: 3,
      angle: 270,
      spread: 50,
      startVelocity: 1,
      gravity: 0.3,
      decay: 0.97,
      ticks: 700,
      origin: { x: Math.random(), y: -0.05 },
      colors: ["#3a3a3a", "#555555", "#2b2b2b", "#4e342e", "#616161"],
      shapes: ["circle", "square"],
      scalar: 0.9,
      disableForReducedMotion: true,
    });
    },
    260,
    durationMs,
  );
}

/** Gold confetti and trumpets firing in from both sides. Returns a stop fn. */
export function goldBursts(durationMs = 7000): () => void {
  const f = fire;
  if (!f) return () => {};
  const colors = ["#ffd54f", "#ffca28", "#ffb300", "#fff8e1", "#c62828", "#2e7d32"];
  const side = (x: number, angle: number, count: number, velocity: number) =>
    f({
      particleCount: count,
      angle,
      spread: 60,
      startVelocity: velocity,
      origin: { x, y: 0.72 },
      colors,
      ticks: 320,
      disableForReducedMotion: true,
    });
  side(0, 60, 140, 70);
  side(1, 120, 140, 70);
  let tick = 0;
  return startLoop(
    () => {
    side(0, 60, 8, 55);
    side(1, 120, 8, 55);
    if (tick++ % 4 === 0) {
      for (const [x, angle] of [
        [0, 60],
        [1, 120],
      ] as const) {
        f({
          particleCount: 2,
          angle,
          spread: 45,
          startVelocity: 50,
          origin: { x, y: 0.75 },
          shapes: party(),
          scalar: PARTY_SCALAR,
          flat: true,
          ticks: 300,
          disableForReducedMotion: true,
        });
      }
    }
    },
    180,
    durationMs,
  );
}
