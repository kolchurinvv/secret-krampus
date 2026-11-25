import { createSignal, For, Show } from "solid-js";
import { MAX_SCORE, MIN_SCORE } from "../../shared/types";

// Captions for each half-star step (score 1..10).
const CAPTIONS = [
  "Lump of coal 🪨",
  "Krampus-approved 😈",
  "Regift material 🔁",
  "Meh 😐",
  "It's… fine 🙂",
  "Pretty nice 😊",
  "Really good! 😄",
  "Love it ❤️",
  "Amazing! 🤩",
  "Best gift ever! 🎁",
];

const STAR_PATH =
  "M12 2.6l2.93 5.94 6.56.95-4.75 4.63 1.12 6.53L12 17.57l-5.86 3.08 1.12-6.53-4.75-4.63 6.56-.95z";

function clamp(v: number) {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, v));
}

/**
 * Five big stars that fill in halves. The whole star row is the slider:
 * drag (or tap) across it with a finger or mouse — pointer events rather than
 * an <input type=range>, because iOS won't move a range thumb on a tap. Also
 * keyboard-accessible (arrows / Home / End).
 *
 * `value` is the score 1..10 (score / 2 = stars) or null if not rated yet.
 * `onChange` fires on every step while dragging; debounce network writes.
 */
export function StarSlider(props: {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  let row!: HTMLDivElement;
  const [dragging, setDragging] = createSignal(false);

  const fromPointer = (clientX: number) => {
    const rect = row.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return clamp(Math.ceil(x * MAX_SCORE));
  };

  const set = (v: number) => {
    if (props.disabled || v === props.value) return;
    navigator.vibrate?.(4);
    props.onChange(v);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (props.disabled) return;
    row.setPointerCapture(e.pointerId);
    setDragging(true);
    set(fromPointer(e.clientX));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging()) set(fromPointer(e.clientX));
  };
  const onPointerEnd = () => setDragging(false);

  const onKeyDown = (e: KeyboardEvent) => {
    const v = props.value ?? 0;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? v + 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? v - 1
          : e.key === "Home"
            ? MIN_SCORE
            : e.key === "End"
              ? MAX_SCORE
              : null;
    if (next === null) return;
    e.preventDefault();
    set(clamp(next));
  };

  /** 0, 50 or 100 — how much of star i (0-based) is filled. */
  const fill = (i: number) => {
    const v = props.value ?? 0;
    return Math.round(Math.min(1, Math.max(0, v / 2 - i)) * 100);
  };

  return (
    <div class="sk-starslider" classList={{ "is-disabled": !!props.disabled, "is-dragging": dragging() }}>
      <div
        ref={row}
        class="sk-starslider-row"
        role="slider"
        tabindex={props.disabled ? -1 : 0}
        aria-label={props.label ?? "Gift rating"}
        aria-valuemin={MIN_SCORE}
        aria-valuemax={MAX_SCORE}
        aria-valuenow={props.value ?? undefined}
        aria-valuetext={props.value ? `${props.value / 2} of 5 stars` : "Not rated"}
        aria-disabled={props.disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <For each={[0, 1, 2, 3, 4]}>
          {(i) => (
            <span class="sk-star" classList={{ "is-lit": fill(i) > 0 }}>
              <svg viewBox="0 0 24 24" class="sk-star-empty" aria-hidden="true">
                <path d={STAR_PATH} />
              </svg>
              <svg
                viewBox="0 0 24 24"
                class="sk-star-full"
                aria-hidden="true"
                style={{ "clip-path": `inset(0 ${100 - fill(i)}% 0 0)` }}
              >
                <path d={STAR_PATH} />
              </svg>
            </span>
          )}
        </For>
      </div>
      <div class="sk-starslider-meta">
        <Show when={props.value} fallback={<span class="sk-muted">Drag across the stars</span>}>
          {(v) => (
            <>
              <span class="sk-starslider-caption">{CAPTIONS[v() - 1]}</span>
              <span class="sk-starslider-score">{(v() / 2).toFixed(1)} / 5</span>
            </>
          )}
        </Show>
      </div>
    </div>
  );
}
