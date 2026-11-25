import { Show, type JSX } from "solid-js";

const PALETTE = ["#c62828", "#2e7d32", "#ad1457", "#1565c0", "#ef6c00", "#6a1b9a", "#00838f", "#9e9d24"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/**
 * Round avatar: the uploaded image, or coloured initials as a fallback.
 * Size it from the outside (width/height via `style` or `class`); the initials
 * scale with the box through container query units.
 */
export function Avatar(props: {
  name: string;
  url: string | null | undefined;
  class?: string;
  style?: JSX.CSSProperties;
}) {
  return (
    <span
      class={`sk-avatar ${props.class ?? ""}`}
      style={{ "background-color": PALETTE[hash(props.name) % PALETTE.length], ...props.style }}
      title={props.name}
    >
      <Show when={props.url} fallback={<span class="sk-avatar-initials">{initials(props.name)}</span>}>
        <img src={props.url!} alt={props.name} loading="lazy" draggable={false} />
      </Show>
    </span>
  );
}
