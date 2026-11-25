// Small building blocks shared by the TV scenes.
import QRCode from "qrcode";
import { createEffect, createMemo, createResource, createSignal, For, on, onCleanup, onMount, Show, untrack } from "solid-js";
import type { PublicParticipant } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { fitGrid } from "./util";

/** Gentle CSS snowfall behind everything. */
/**
 * Keeps a display title on one line, shrinking its font only if it would
 * overflow its container. Russian copy runs 20–30% longer than English and the
 * display font may change, so this measures instead of guessing. Use as
 * `ref={fitText}`; it re-fits on resize, text changes and font loads.
 */
export function fitText(el: HTMLElement) {
  el.classList.add("tv-fit");
  let raf = 0;
  const fit = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.fontSize = "";
      const avail = el.clientWidth;
      const need = el.scrollWidth;
      if (avail > 0 && need > avail) {
        const base = Number.parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.floor(base * (avail / need) * 0.97)}px`;
      }
    });
  };
  const ro = new ResizeObserver(fit);
  ro.observe(el);
  if (el.parentElement) ro.observe(el.parentElement);
  const mo = new MutationObserver(fit);
  mo.observe(el, { childList: true, characterData: true, subtree: true });
  document.fonts?.addEventListener("loadingdone", fit);
  void document.fonts?.ready.then(fit);
  onCleanup(() => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    mo.disconnect();
    document.fonts?.removeEventListener("loadingdone", fit);
  });
}

export function Snow(props: { count?: number }) {
  const flakes = Array.from({ length: props.count ?? 70 }, () => ({
    left: Math.random() * 100,
    size: 0.25 + Math.random() * 0.6,
    duration: 9 + Math.random() * 14,
    delay: -Math.random() * 20,
    sway: 1 + Math.random() * 3,
    opacity: 0.25 + Math.random() * 0.5,
  }));
  return (
    <div class="tv-snow" aria-hidden="true">
      <For each={flakes}>
        {(f) => (
          <span
            class="tv-flake"
            style={{
              left: `${f.left}%`,
              "--size": `calc(${f.size} * var(--u))`,
              "--sway": `calc(${f.sway} * var(--u))`,
              "animation-duration": `${f.duration}s, ${f.duration / 3}s`,
              "animation-delay": `${f.delay}s, ${f.delay}s`,
              opacity: f.opacity,
            }}
          />
        )}
      </For>
    </div>
  );
}

/**
 * A number that rolls: the old value slides up and out while the new one
 * slides in from below.
 */
export function RollingNumber(props: { value: number; class?: string }) {
  type Entry = { key: number; value: number; leaving: () => boolean; setLeaving: (v: boolean) => void };
  let seq = 0;
  const make = (value: number): Entry => {
    const [leaving, setLeaving] = createSignal(false);
    return { key: seq++, value, leaving, setLeaving };
  };
  const [entries, setEntries] = createSignal<Entry[]>([make(untrack(() => props.value))]);
  createEffect(
    on(
      () => props.value,
      (v) => {
        const current = entries();
        if (current[current.length - 1]?.value === v) return;
        for (const e of current) e.setLeaving(true);
        const fresh = make(v);
        setEntries([...current, fresh]);
        setTimeout(() => setEntries((es) => es.filter((e) => !e.leaving())), 650);
      },
      { defer: true },
    ),
  );
  return (
    <span class={`tv-roll ${props.class ?? ""}`}>
      <For each={entries()}>
        {(e) => (
          <span class="tv-roll-item" classList={{ "is-leaving": e.leaving(), "is-entering": e.key > 0 }}>
            {e.value}
          </span>
        )}
      </For>
    </span>
  );
}

/** Five stars, filled to `stars` (0..5, any fraction). */
export function StarRating(props: { stars: number | null; class?: string }) {
  return (
    <span class={`tv-rating ${props.class ?? ""}`}>
      <For each={[0, 1, 2, 3, 4]}>
        {(i) => (
          <span class="tv-rating-star">
            <span class="tv-rating-empty">★</span>
            <span
              class="tv-rating-fill"
              style={{ width: `${Math.max(0, Math.min(1, (props.stars ?? 0) - i)) * 100}%` }}
            >
              ★
            </span>
          </span>
        )}
      </For>
    </span>
  );
}

/** Donut progress with "7/12" in the middle. */
export function ProgressRing(props: { value: number; total: number; label: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = () => (props.total > 0 ? Math.min(1, props.value / props.total) : 0);
  return (
    <div class="tv-ring">
      <svg viewBox="0 0 100 100">
        <circle class="tv-ring-track" cx="50" cy="50" r={r} />
        <circle
          class="tv-ring-bar"
          cx="50"
          cy="50"
          r={r}
          stroke-dasharray={`${c}`}
          stroke-dashoffset={`${c * (1 - frac())}`}
        />
      </svg>
      <div class="tv-ring-text">
        <div class="tv-ring-count">
          <RollingNumber value={props.value} />
          <span class="tv-ring-total">/{props.total}</span>
        </div>
        <div class="tv-ring-label">{props.label}</div>
      </div>
    </div>
  );
}

/** QR code as inline SVG (dark on white, so phones scan it reliably). */
export function Qr(props: { url: string; class?: string }) {
  const [svg] = createResource(
    () => props.url,
    (url) =>
      QRCode.toString(url, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#1b0f0f", light: "#ffffff" },
      }),
  );
  return <div class={`tv-qr ${props.class ?? ""}`} innerHTML={svg() ?? ""} />;
}

export type WallMark = "check" | "dim" | undefined;

/**
 * A grid of avatars with names that always fills its box: the column count
 * is chosen so the tiles are as big as possible. Tiles pop in when a new
 * person appears (the store keeps object identity, so <For> only creates
 * DOM for genuinely new people).
 */
export function AvatarWall(props: {
  people: readonly PublicParticipant[];
  mark?: (p: PublicParticipant) => WallMark;
  maxCellFraction?: number;
}) {
  let box!: HTMLDivElement;
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  const mountedAt = Date.now();
  onMount(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(box);
    onCleanup(() => ro.disconnect());
  });
  const layout = createMemo(() => {
    const { w, h } = size();
    const gap = Math.max(8, w * 0.012);
    const fit = fitGrid(props.people.length, w, h, 1.32, gap, h * (props.maxCellFraction ?? 0.42));
    return { ...fit, gap };
  });
  return (
    <div class="tv-wall" ref={box}>
      <div
        class="tv-wall-grid"
        style={{
          "grid-template-columns": `repeat(${layout().cols}, ${layout().cell}px)`,
          gap: `${layout().gap}px`,
          "--cell": `${layout().cell}px`,
        }}
      >
        <For each={props.people}>
          {(p, i) => {
            const delay = Date.now() - mountedAt < 600 ? Math.min(i() * 45, 900) : 0;
            const mark = () => props.mark?.(p);
            return (
              <div
                class="tv-wall-tile"
                classList={{ "is-dim": mark() === "dim", "is-checked": mark() === "check" }}
                style={{ "animation-delay": `${delay}ms` }}
              >
                <div class="tv-wall-avatar">
                  <Avatar name={p.name} url={p.avatarUrl} class="tv-wall-img" />
                  <Show when={mark() === "check"}>
                    <span class="tv-wall-check">✓</span>
                  </Show>
                </div>
                <div class="tv-wall-name">{p.name}</div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
