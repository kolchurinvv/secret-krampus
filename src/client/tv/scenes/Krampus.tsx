import { createMemo, For, Show } from "solid-js";
import type { PublicState } from "../../../shared/types";
import { Avatar } from "../../components/Avatar";
import { useMessages } from "../../lib/i18n";
import { fitText, StarRating } from "../Bits";
import { coalRain } from "../confetti";
import { tvMessages } from "../messages";
import { createRevealTimeline } from "./reveal";

type Phase = "drumroll" | "reveal" | "gray" | "final";

/** The party pooper: drum roll, a big sad face, horns, coal and a sad trombone. */
export function KrampusScene(props: { data: PublicState; toLocal: (ms: number) => number }) {
  const m = useMessages(tvMessages);
  const entries = createMemo(() => {
    const byId = new Map(props.data.participants.map((p) => [p.id, p]));
    return (props.data.krampus?.entries ?? []).map((e) => ({
      ...e,
      name: byId.get(e.id)?.name ?? "???",
      avatarUrl: byId.get(e.id)?.avatarUrl ?? null,
    }));
  });

  return (
    <Show
      when={props.data.krampus}
      fallback={
        <div class="sc-kr" data-phase="drumroll">
          <div class="sc-kr-teaser">{m().krampusDeciding}</div>
        </div>
      }
    >
      <KrampusReveal entries={entries()} startLocal={props.toLocal(props.data.scene.startedAt)} />
    </Show>
  );
}

function KrampusReveal(props: {
  entries: { id: string; name: string; avatarUrl: string | null; giftForName: string; stars: number | null }[];
  startLocal: number;
}) {
  const m = useMessages(tvMessages);
  const { phase, rejoined } = createRevealTimeline<Phase>({
    startLocal: props.startLocal,
    phases: [
      { phase: "drumroll", at: 0 },
      { phase: "reveal", at: 3600 },
      { phase: "gray", at: 4500 },
      { phase: "final", at: 5100 },
    ],
    finalPhase: "final",
    rejoinAfterMs: 5500,
    sounds: [
      { at: 0, name: "drumroll", durationMs: 3500 },
      { at: 3900, name: "sad-trombone" },
    ],
    effects: [{ at: 4800, run: () => coalRain(14000) }],
  });
  const multi = () => props.entries.length > 1;

  return (
    <div
      class="sc-kr"
      classList={{ "is-rejoin": rejoined }}
      data-phase={phase()}
      style={{ "--n": Math.max(1, props.entries.length) }}
    >
      <div class="sc-kr-dim" />
      <Show when={phase() === "drumroll"}>
        <div class="sc-kr-teaser">
          {m().krampusDrumroll}
          <span class="sc-kr-dots">…</span>
        </div>
      </Show>
      <Show when={phase() !== "drumroll"}>
        <div class="sc-kr-balloons" aria-hidden="true">
          <span>🎈</span>
          <span>🎈</span>
          <span>🎈</span>
        </div>
        <div class="sc-kr-title" ref={fitText}>
          {m().krampusTitle(multi())}
          <span class="sc-kr-drip" style={{ left: "9%", "--d": "0.1s", "--h": "1.2" }} />
          <span class="sc-kr-drip" style={{ left: "27%", "--d": "0.5s", "--h": "0.7" }} />
          <span class="sc-kr-drip" style={{ left: "48%", "--d": "0.25s", "--h": "1.5" }} />
          <span class="sc-kr-drip" style={{ left: "66%", "--d": "0.8s", "--h": "0.9" }} />
          <span class="sc-kr-drip" style={{ left: "86%", "--d": "0.4s", "--h": "1.1" }} />
        </div>
        <div class="sc-kr-entries">
          <For each={props.entries}>
            {(e) => (
              <div class="sc-kr-entry">
                <div class="sc-kr-avatar-wrap">
                  <Horns />
                  <Avatar name={e.name} url={e.avatarUrl} class="sc-kr-avatar" />
                </div>
                <div class="sc-kr-name" ref={fitText}>
                  {e.name}
                </div>
                <div class="sc-kr-meta">
                  <div class="sc-kr-gift">{m().krampusForGift(e.giftForName)}</div>
                  <Show when={e.stars !== null}>
                    <div class="sc-kr-score">
                      <StarRating stars={e.stars} />
                      <span>{m().krampusScore(e.stars!)}</span>
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
        <div class="sc-kr-sub">{m().krampusCoal}</div>
      </Show>
    </div>
  );
}

function Horns() {
  return (
    <svg class="sc-kr-horns" viewBox="0 0 200 90" aria-hidden="true">
      <defs>
        <linearGradient id="hornGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#2a0000" />
          <stop offset="55%" stop-color="#7f0d0d" />
          <stop offset="100%" stop-color="#d84315" />
        </linearGradient>
      </defs>
      <path d="M58 88 C 34 70, 14 40, 22 4 C 34 34, 56 54, 86 74 Z" fill="url(#hornGrad)" stroke="#120000" stroke-width="2" />
      <path d="M142 88 C 166 70, 186 40, 178 4 C 166 34, 144 54, 114 74 Z" fill="url(#hornGrad)" stroke="#120000" stroke-width="2" />
    </svg>
  );
}
