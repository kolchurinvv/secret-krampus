import { Show } from "solid-js";
import type { PublicState } from "../../shared/types";
import { useMessages } from "../lib/i18n";
import { meMessages } from "./messages";

export function StarsCard(props: { participantId: string; live: PublicState | null }) {
  const m = useMessages(meMessages);
  const info = () => {
    const ps = props.live?.participants ?? [];
    const me = ps.find((p) => p.id === props.participantId);
    if (!me) return null;
    const rank = 1 + ps.filter((p) => p.stars > me.stars).length;
    return { stars: me.stars, rank, total: ps.length };
  };
  return (
    <Show when={info()}>
      {(i) => (
        <article class="round sk-card sk-stars-card">
          <div class="sk-stars-big" aria-hidden="true">
            ⭐
          </div>
          <div class="max">
            <div class="sk-stars-count">{m().stars(i().stars)}</div>
            <div class="sk-muted">{m().rank(i().rank, i().total)}</div>
          </div>
        </article>
      )}
    </Show>
  );
}
