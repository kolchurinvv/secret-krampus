import { createSignal, lazy, Show } from "solid-js";
import { useLive } from "../lib/live";
import { TvShow } from "../tv/TvShow";
import type { TvSource } from "../tv/types";

const MockHud = lazy(() => import("../tv/mock").then((m) => ({ default: m.MockHud })));

/**
 * The public TV display. Query flags:
 *   ?preview=1  — admin iframe: no start overlay, no sound
 *   ?mock=1     — fake data for development (&scene=leaderboard etc.)
 */
export default function Live() {
  const params = new URLSearchParams(window.location.search);
  const preview = params.has("preview");
  const mock = params.has("mock");
  const [source, setSource] = createSignal<TvSource | null>(mock ? null : useLive());
  if (mock) {
    void import("../tv/mock").then((m) => setSource(() => m.createMockSource(params)));
  }
  return (
    <Show when={source()}>
      {(s) => (
        <>
          <TvShow source={s()} preview={preview} />
          <Show when={mock}>
            <MockHud />
          </Show>
        </>
      )}
    </Show>
  );
}
