import { createMemo, For, Show } from "solid-js";
import type { PublicState } from "../../../shared/types";
import { Avatar } from "../../components/Avatar";
import { goldBursts } from "../confetti";
import { createRevealTimeline } from "./reveal";

type Phase = "drumroll" | "reveal";

/** The winner's trumpet: crowned avatar, gold rays, confetti and a fanfare. */
export function ChampionScene(props: { data: PublicState; toLocal: (ms: number) => number }) {
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
          <div class="sc-ch-teaser">Crowning the champion… 🥁</div>
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
          And the champion is<span class="sc-kr-dots">…</span>
        </div>
      </Show>
      <Show when={phase() === "reveal"}>
        <div class="sc-ch-rays" aria-hidden="true" />
        <div class="sc-ch-title">{props.winners.length > 1 ? "CHAMPIONS" : "CHAMPION"}</div>
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
                <div class="sc-ch-name">{w.name}</div>
              </div>
            )}
          </For>
        </div>
        <div class="sc-ch-stars">
          ⭐ {props.stars} {props.stars === 1 ? "star" : "stars"}
        </div>
      </Show>
    </div>
  );
}
