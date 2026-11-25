import { createMemo, For, Show } from "solid-js";
import type { PublicState } from "../../../shared/types";
import { Avatar } from "../../components/Avatar";
import { useMessages } from "../../lib/i18n";
import { fitText } from "../Bits";
import { goldBursts } from "../confetti";
import { tvMessages } from "../messages";
import { createRevealTimeline } from "./reveal";

type Phase = "drumroll" | "reveal";

/** The winner's trumpet: crowned avatar, gold rays, confetti and a fanfare. */
export function ChampionScene(props: { data: PublicState; toLocal: (ms: number) => number }) {
  const m = useMessages(tvMessages);
  const winners = createMemo(() => {
    const byId = new Map(props.data.participants.map((p) => [p.id, p]));
    return (props.data.champion?.ids ?? []).map((id) => ({
      id,
      name: byId.get(id)?.name ?? "???",
      avatarUrl: byId.get(id)?.avatarUrl ?? null,
    }));
  });
  return (
    <Show
      when={props.data.champion}
      fallback={
        <div class="sc-ch" data-phase="drumroll">
          <div class="sc-ch-teaser">{m().championCrowning}</div>
        </div>
      }
    >
      {(champ) => (
        <ChampionReveal
          winners={winners()}
          stars={champ().stars}
          startLocal={props.toLocal(props.data.scene.startedAt)}
        />
      )}
    </Show>
  );
}

function ChampionReveal(props: {
  winners: { id: string; name: string; avatarUrl: string | null }[];
  stars: number;
  startLocal: number;
}) {
  const m = useMessages(tvMessages);
  const { phase, rejoined } = createRevealTimeline<Phase>({
    startLocal: props.startLocal,
    phases: [
      { phase: "drumroll", at: 0 },
      { phase: "reveal", at: 2400 },
    ],
    finalPhase: "reveal",
    rejoinAfterMs: 4000,
    sounds: [
      { at: 0, name: "drumroll", durationMs: 2300 },
      { at: 2400, name: "fanfare" },
    ],
    effects: [{ at: 2450, run: () => goldBursts(7000) }],
  });
  return (
    <div
      class="sc-ch"
      classList={{ "is-rejoin": rejoined }}
      data-phase={phase()}
      style={{ "--n": Math.max(1, props.winners.length) }}
    >
      <Show when={phase() === "drumroll"}>
        <div class="sc-ch-teaser">
          {m().championDrumroll}
          <span class="sc-kr-dots">…</span>
        </div>
      </Show>
      <Show when={phase() === "reveal"}>
        <div class="sc-ch-rays" aria-hidden="true" />
        <div class="sc-ch-title" ref={fitText}>
          {m().championTitle(props.winners.length > 1)}
        </div>
        <div class="sc-ch-entries">
          <For each={props.winners}>
            {(w) => (
              <div class="sc-ch-entry">
                <div class="sc-ch-avatar-wrap">
                  <span class="sc-ch-crown">👑</span>
                  <Avatar name={w.name} url={w.avatarUrl} class="sc-ch-avatar" />
                  <span class="sc-ch-trumpet left">🎺</span>
                  <span class="sc-ch-trumpet right">🎺</span>
                </div>
                <div class="sc-ch-name" ref={fitText}>
                  {w.name}
                </div>
              </div>
            )}
          </For>
        </div>
        <div class="sc-ch-stars">{m().championStars(props.stars)}</div>
      </Show>
    </div>
  );
}
