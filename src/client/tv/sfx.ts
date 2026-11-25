// Party sound effects, synthesized with Web Audio so there is nothing to
// license. Drop a real recording at public/sfx/<name>.mp3 and it wins.
//
// Browsers block audio until a user gesture, so nothing plays until
// unlockAudio() runs from the TV's "start the show" click. The admin preview
// iframe never unlocks, so it stays silent.

export type SfxName = "drumroll" | "sad-trombone" | "fanfare";
const NAMES: SfxName[] = ["drumroll", "sad-trombone", "fanfare"];

export type SfxHandle = { stop(): void };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
let noise: AudioBuffer | null = null;
const fileUrls = new Map<SfxName, string>();

export function soundEnabled() {
  return enabled;
}

export async function unlockAudio(): Promise<void> {
  try {
    if (!ctx) {
      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
    }
    await ctx.resume();
    enabled = true;
  } catch {
    enabled = false;
    return;
  }
  // Prefer real recordings when present. A missing file comes back as the
  // SPA's index.html, so check the content type, not just the status.
  await Promise.all(
    NAMES.map(async (name) => {
      try {
        const url = `/sfx/${name}.mp3`;
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok && (res.headers.get("content-type") ?? "").startsWith("audio/")) fileUrls.set(name, url);
      } catch {
        /* synth fallback */
      }
    }),
  );
}

/** Plays a sound if audio is unlocked. Returns a handle to cut it short. */
export function play(name: SfxName, opts: { durationMs?: number } = {}): SfxHandle | null {
  if (!enabled || !ctx || !master) return null;
  const url = fileUrls.get(name);
  if (url) {
    const audio = new Audio(url);
    void audio.play().catch(() => {});
    return { stop: () => audio.pause() };
  }
  switch (name) {
    case "drumroll":
      return drumRoll(ctx, master, opts.durationMs ?? 3500);
    case "sad-trombone":
      return sadTrombone(ctx, master);
    case "fanfare":
      return fanfare(ctx, master);
  }
}

/** A per-sound bus so stop() can fade just this sound out. */
function bus(c: AudioContext, out: AudioNode, level: number) {
  const g = c.createGain();
  g.gain.value = level;
  g.connect(out);
  const handle: SfxHandle = {
    stop() {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.15);
      setTimeout(() => g.disconnect(), 300);
    },
  };
  return { node: g, handle };
}

function noiseBuffer(c: AudioContext) {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const len = c.sampleRate; // 1 s
  noise = c.createBuffer(1, len, c.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  return noise;
}

/** Snare roll with a crescendo, ending on a cymbal crash and a kick. */
function drumRoll(c: AudioContext, out: AudioNode, durationMs: number): SfxHandle {
  const { node, handle } = bus(c, out, 0.8);
  const buf = noiseBuffer(c);
  const dur = Math.max(0.5, durationMs / 1000);
  const t0 = c.currentTime + 0.05;
  let t = t0;
  let i = 0;
  while (t < t0 + dur - 0.08) {
    const progress = (t - t0) / dur;
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900 + Math.random() * 400;
    bp.Q.value = 0.9;
    const g = c.createGain();
    const peak = (0.1 + 0.55 * progress * progress) * (i % 2 === 0 ? 1 : 0.72);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    src.connect(bp).connect(g).connect(node);
    src.start(t, Math.random() * 0.8, 0.09);
    t += 0.048 - 0.014 * progress;
    i++;
  }
  const tHit = t0 + dur;
  // Cymbal crash.
  const crash = c.createBufferSource();
  crash.buffer = buf;
  crash.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 5500;
  const cg = c.createGain();
  cg.gain.setValueAtTime(0.0001, tHit);
  cg.gain.exponentialRampToValueAtTime(0.55, tHit + 0.01);
  cg.gain.exponentialRampToValueAtTime(0.0001, tHit + 1.8);
  crash.connect(hp).connect(cg).connect(node);
  crash.start(tHit);
  crash.stop(tHit + 1.9);
  // Kick.
  const kick = c.createOscillator();
  kick.type = "sine";
  kick.frequency.setValueAtTime(150, tHit);
  kick.frequency.exponentialRampToValueAtTime(42, tHit + 0.25);
  const kg = c.createGain();
  kg.gain.setValueAtTime(0.0001, tHit);
  kg.gain.exponentialRampToValueAtTime(0.9, tHit + 0.005);
  kg.gain.exponentialRampToValueAtTime(0.0001, tHit + 0.5);
  kick.connect(kg).connect(node);
  kick.start(tHit);
  kick.stop(tHit + 0.55);
  return handle;
}

/** "Wah, wah, wah, waaaah": four descending semitones, the last one wobbling. */
function sadTrombone(c: AudioContext, out: AudioNode): SfxHandle {
  const { node, handle } = bus(c, out, 0.55);
  const notes: [number, number][] = [
    [293.66, 0.52], // D4
    [277.18, 0.52], // C#4
    [261.63, 0.52], // C4
    [246.94, 2.1], // B3, held
  ];
  let t = c.currentTime + 0.05;
  notes.forEach(([f, d], i) => {
    const last = i === notes.length - 1;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 7;
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(1700, t + Math.min(0.16, d * 0.3));
    filter.frequency.exponentialRampToValueAtTime(480, t + d);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.6, t + 0.04);
    env.gain.setValueAtTime(0.6, t + d - 0.1);
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    filter.connect(env).connect(node);

    const oscs = [0, 9].map((detune) => {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.detune.value = detune;
      o.frequency.setValueAtTime(f, t);
      // Each note sags at the end; the last one sags further.
      o.frequency.linearRampToValueAtTime(f * (last ? 0.93 : 0.97), t + d);
      o.connect(filter);
      o.start(t);
      o.stop(t + d + 0.05);
      return o;
    });

    if (last) {
      const lfo = c.createOscillator();
      lfo.frequency.value = 5.5;
      const pitchDepth = c.createGain();
      pitchDepth.gain.setValueAtTime(0, t);
      pitchDepth.gain.linearRampToValueAtTime(8, t + 0.5);
      lfo.connect(pitchDepth);
      for (const o of oscs) pitchDepth.connect(o.frequency);
      const wahDepth = c.createGain();
      wahDepth.gain.value = 260;
      lfo.connect(wahDepth).connect(filter.frequency);
      lfo.start(t);
      lfo.stop(t + d);
    }
    t += d + 0.05;
  });
  return handle;
}

/** Brassy "ta-ta-ta-taaa, ta-ta TAAAA". */
function fanfare(c: AudioContext, out: AudioNode): SfxHandle {
  const { node, handle } = bus(c, out, 0.4);
  const t0 = c.currentTime + 0.05;
  const G4 = 392.0, A4 = 440.0, C5 = 523.25, E5 = 659.25, G5 = 783.99;
  const seq: [number[], number, number][] = [
    [[G4], 0, 0.13],
    [[G4], 0.16, 0.13],
    [[G4], 0.32, 0.13],
    [[C5], 0.48, 0.5],
    [[A4], 1.02, 0.13],
    [[C5], 1.18, 0.13],
    [[C5, E5, G5], 1.34, 1.7],
  ];
  for (const [freqs, at, d] of seq) for (const f of freqs) brass(c, node, f, t0 + at, d);
  return handle;
}

function brass(c: AudioContext, out: AudioNode, f: number, t: number, d: number) {
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 1.5;
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(3200, t + 0.05);
  filter.frequency.exponentialRampToValueAtTime(1800, t + Math.min(d, 0.3));
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
  env.gain.setValueAtTime(0.42, t + Math.max(0.05, d - 0.08));
  env.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
  filter.connect(env).connect(out);
  const types: [OscillatorType, number, number][] = [
    ["sawtooth", 0, 1],
    ["sawtooth", 6, 0.8],
    ["square", -5, 0.35],
  ];
  for (const [type, detune, level] of types) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    const g = c.createGain();
    g.gain.value = level;
    if (d > 0.4) {
      // A little vibrato on held notes.
      const lfo = c.createOscillator();
      lfo.frequency.value = 5;
      const depth = c.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(4, t + 0.4);
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + d + 0.15);
    }
    o.connect(g).connect(filter);
    o.start(t);
    o.stop(t + d + 0.15);
  }
}
