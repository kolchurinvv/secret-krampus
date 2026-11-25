import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js";
import type { SceneKind } from "../../shared/types";
import { confirmDialog } from "../components/Feedback";
import { api } from "../lib/api";
import { useAdmin } from "./context";

const SCENE_INFO: { kind: SceneKind; icon: string; label: string; hint: string }[] = [
  { kind: "title", icon: "celebration", label: "Title", hint: "Party name + your announcement" },
  { kind: "lobby", icon: "qr_code_2", label: "Lobby", hint: "QR code for last-minute sign-ups" },
  { kind: "voting", icon: "how_to_vote", label: "Voting", hint: "Gift-rating progress" },
  { kind: "leaderboard", icon: "leaderboard", label: "Leaderboard", hint: "Live 3D contest scores" },
  { kind: "krampus", icon: "sentiment_very_dissatisfied", label: "Krampus", hint: "The reveal (when votes are in)" },
  { kind: "champion", icon: "emoji_events", label: "Champion", hint: "Crowns the current leaders" },
];

function Preview() {
  let box!: HTMLDivElement;
  const [scale, setScale] = createSignal(0.2);
  onMount(() => {
    const ro = new ResizeObserver(() => setScale(box.clientWidth / 1920));
    ro.observe(box);
    onCleanup(() => ro.disconnect());
  });
  return (
    <div class="sk-preview" ref={box}>
      <iframe
        src="/live?preview=1"
        title="TV preview"
        style={{ transform: `scale(${scale()})` }}
        tabindex={-1}
      />
    </div>
  );
}

export function TvTab() {
  const { state, run, busy } = useAdmin();
  const [message, setMessage] = createSignal(state().scene.message);
  const [dirty, setDirty] = createSignal(false);

  createEffect(() => {
    const m = state().scene.message;
    if (!dirty()) setMessage(m);
  });

  const disabledReason = (kind: SceneKind) => {
    if (kind === "krampus" && !state().voting.hasResult) return "Votes aren't in yet";
    if (kind === "champion" && state().leaders.stars === 0) return "No stars yet";
    return null;
  };

  const pick = async (kind: SceneKind) => {
    if (kind === state().scene.kind && kind !== "krampus" && kind !== "champion") return;
    if (kind === "krampus" || kind === "champion") {
      const ok = await confirmDialog({
        title: kind === "krampus" ? "Reveal the Secret Krampus?" : "Crown the champion?",
        message:
          kind === "krampus"
            ? "Plays the reveal (with sad trombone) on the TV."
            : `Crowns ${state().leaders.names.join(", ")} (${state().leaders.stars} ⭐) with a fanfare.`,
        confirmLabel: kind === "krampus" ? "Reveal!" : "Crown",
      });
      if (!ok) return;
    }
    await run(() => api.post("/api/admin/scene", { kind }));
  };

  const saveMessage = async (e: Event) => {
    e.preventDefault();
    const r = await run(() => api.post("/api/admin/message", { message: message().trim() }), "Announcement updated");
    if (r) setDirty(false);
  };

  return (
    <div class="sk-stack">
      <article class="round sk-card">
        <h6>On the TV now</h6>
        <div class="sk-scenes">
          <For each={SCENE_INFO}>
            {(s) => (
              <button
                class="sk-scene"
                classList={{ "is-active": state().scene.kind === s.kind }}
                disabled={busy() || !!disabledReason(s.kind)}
                title={disabledReason(s.kind) ?? s.hint}
                onClick={() => void pick(s.kind)}
              >
                <i>{s.icon}</i>
                <span class="sk-scene-label">{s.label}</span>
                <span class="sk-scene-hint">{disabledReason(s.kind) ?? s.hint}</span>
              </button>
            )}
          </For>
        </div>
      </article>

      <article class="round sk-card">
        <form class="sk-stack" onSubmit={saveMessage}>
          <h6>Announcement</h6>
          <div class="field label border round textarea">
            <textarea
              rows={2}
              maxlength={200}
              placeholder=" "
              value={message()}
              onInput={(e) => {
                setDirty(true);
                setMessage(e.currentTarget.value);
              }}
            />
            <label>Shown on the Title scene</label>
          </div>
          <nav class="right-align">
            <button type="button" class="transparent" disabled={busy() || !message()} onClick={() => { setDirty(true); setMessage(""); }}>
              Clear
            </button>
            <button type="submit" class="round" disabled={busy() || !dirty()}>
              <i>campaign</i>
              <span>Update</span>
            </button>
          </nav>
        </form>
      </article>

      <article class="round sk-card">
        <div class="sk-form-row">
          <h6 class="max">Preview</h6>
          <a class="button border round small" href="/live" target="_blank" rel="noopener">
            <i>open_in_new</i>
            <span>Open TV page</span>
          </a>
        </div>
        <Preview />
      </article>
    </div>
  );
}
