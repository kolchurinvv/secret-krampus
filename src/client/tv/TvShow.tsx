import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, untrack } from "solid-js";
import type { SceneKind } from "../../shared/types";
import { Snow } from "./Bits";
import { attachConfetti, clearConfetti } from "./confetti";
import { SceneActive } from "./scene-context";
import { ChampionScene } from "./scenes/Champion";
import { KrampusScene } from "./scenes/Krampus";
import { LeaderboardScene } from "./scenes/Leaderboard";
import { LobbyScene } from "./scenes/Lobby";
import { TitleScene } from "./scenes/Title";
import { VotingScene } from "./scenes/Voting";
import { unlockAudio } from "./sfx";
import type { TvSource } from "./types";
import "./tv.css";

type Layer = { key: string; kind: SceneKind; leaving: () => boolean; setLeaving: (v: boolean) => void };

/**
 * The whole TV: a fixed 100dvw×100dvh stage, snow, the current scene (with a
 * cross-fade when the admin switches), the confetti canvas, and — unless this
 * is the admin's preview — a one-click "start the show" overlay that goes
 * fullscreen and unlocks sound.
 */
export function TvShow(props: { source: TvSource; preview: boolean }) {
  const [started, setStarted] = createSignal(props.preview);
  const [idle, setIdle] = createSignal(false);
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    onCleanup(attachConfetti(canvas));
    // Belt and braces against scrollbars on the TV.
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    onCleanup(() => (html.style.overflow = prevOverflow));
    let t: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2500);
    };
    wake();
    window.addEventListener("pointermove", wake);
    onCleanup(() => {
      window.removeEventListener("pointermove", wake);
      clearTimeout(t);
    });
  });

  const start = async () => {
    try {
      await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    } catch {
      /* fullscreen is a nice-to-have */
    }
    await unlockAudio();
    setStarted(true);
  };

  return (
    <div class="tv" classList={{ "tv--idle": idle(), "tv--preview": props.preview }}>
      <Snow />
      <Show when={props.source.data} fallback={<div class="tv-connecting">Connecting to the North Pole…</div>}>
        <SceneStage source={props.source} />
      </Show>
      <canvas class="tv-confetti" ref={canvas} />
      <Show when={!started()}>
        <button class="tv-start" onClick={() => void start()} autofocus>
          <span class="tv-start-emoji">😈🎄</span>
          <span class="tv-start-text">Click to start the show</span>
          <span class="tv-start-hint">fullscreen + sound</span>
        </button>
      </Show>
    </div>
  );
}

function SceneStage(props: { source: TvSource }) {
  const data = () => props.source.data!;
  // Re-selecting the same scene restarts it (new startedAt), e.g. to replay a reveal.
  const sceneKey = createMemo(() => `${data().scene.kind}@${data().scene.startedAt}`);
  const [layers, setLayers] = createSignal<Layer[]>([]);

  createEffect(
    on(sceneKey, (key) => {
      const kind = untrack(() => data().scene.kind);
      const [leaving, setLeaving] = createSignal(false);
      const current = untrack(layers);
      for (const l of current) l.setLeaving(true);
      // Particles from the previous scene must not rain into this one.
      clearConfetti();
      setLayers([...current, { key, kind, leaving, setLeaving }]);
      setTimeout(() => setLayers((ls) => ls.filter((l) => !l.leaving())), 900);
    }),
  );

  return (
    <For each={layers()}>
      {(layer) => (
        <div class="tv-scene" classList={{ "is-leaving": layer.leaving() }} data-scene={layer.kind}>
          <SceneActive.Provider value={() => !layer.leaving()}>
          <Switch>
            <Match when={layer.kind === "title"}>
              <TitleScene data={data()} />
            </Match>
            <Match when={layer.kind === "lobby"}>
              <LobbyScene data={data()} />
            </Match>
            <Match when={layer.kind === "voting"}>
              <VotingScene data={data()} />
            </Match>
            <Match when={layer.kind === "leaderboard"}>
              <LeaderboardScene data={data()} />
            </Match>
            <Match when={layer.kind === "krampus"}>
              <KrampusScene data={data()} toLocal={props.source.toLocal} />
            </Match>
            <Match when={layer.kind === "champion"}>
              <ChampionScene data={data()} toLocal={props.source.toLocal} />
            </Match>
          </Switch>
          </SceneActive.Provider>
        </div>
      )}
    </For>
  );
}
