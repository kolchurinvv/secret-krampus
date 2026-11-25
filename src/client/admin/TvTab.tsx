import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js";
import type { SceneKind } from "../../shared/types";
import { confirmDialog } from "../components/Feedback";
import { api } from "../lib/api";
import { useMessages } from "../lib/i18n";
import { useAdmin } from "./context";
import { adminMessages, type AdminMessages } from "./messages";

const SCENE_INFO: { kind: SceneKind; icon: string; label: (m: AdminMessages) => string; hint: (m: AdminMessages) => string }[] = [
  { kind: "title", icon: "celebration", label: (m) => m.sceneTitle, hint: (m) => m.sceneTitleHint },
  { kind: "lobby", icon: "qr_code_2", label: (m) => m.sceneLobby, hint: (m) => m.sceneLobbyHint },
  { kind: "voting", icon: "how_to_vote", label: (m) => m.sceneVoting, hint: (m) => m.sceneVotingHint },
  { kind: "leaderboard", icon: "leaderboard", label: (m) => m.sceneLeaderboard, hint: (m) => m.sceneLeaderboardHint },
  { kind: "krampus", icon: "sentiment_very_dissatisfied", label: (m) => m.sceneKrampus, hint: (m) => m.sceneKrampusHint },
  { kind: "champion", icon: "emoji_events", label: (m) => m.sceneChampion, hint: (m) => m.sceneChampionHint },
];

function Preview() {
  const m = useMessages(adminMessages);
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
        title={m().tvPreviewTitle}
        style={{ transform: `scale(${scale()})` }}
        tabindex={-1}
      />
    </div>
  );
}

export function TvTab() {
  const { state, run, busy } = useAdmin();
  const m = useMessages(adminMessages);
  const [message, setMessage] = createSignal(state().scene.message);
  const [dirty, setDirty] = createSignal(false);

  createEffect(() => {
    const m = state().scene.message;
    if (!dirty()) setMessage(m);
  });

  const disabledReason = (kind: SceneKind) => {
    if (kind === "krampus" && !state().voting.hasResult) return m().votesNotIn;
    if (kind === "champion" && state().leaders.stars === 0) return m().noStarsYet;
    return null;
  };

  const pick = async (kind: SceneKind) => {
    if (kind === state().scene.kind && kind !== "krampus" && kind !== "champion") return;
    if (kind === "krampus" || kind === "champion") {
      const ok = await confirmDialog({
        title: kind === "krampus" ? m().revealKrampusTitle : m().crownChampionTitle,
        message:
          kind === "krampus"
            ? m().revealKrampusMessage
            : m().crownMessage(state().leaders.names.join(", "), state().leaders.stars),
        confirmLabel: kind === "krampus" ? m().revealConfirm : m().crown,
      });
      if (!ok) return;
    }
    await run(() => api.post("/api/admin/scene", { kind }));
  };

  const saveMessage = async (e: Event) => {
    e.preventDefault();
    const r = await run(() => api.post("/api/admin/message", { message: message().trim() }), m().announcementUpdated);
    if (r) setDirty(false);
  };

  return (
    <div class="sk-stack">
      <article class="round sk-card">
        <h6>{m().onTvNow}</h6>
        <div class="sk-scenes">
          <For each={SCENE_INFO}>
            {(s) => (
              <button
                class="sk-scene"
                classList={{ "is-active": state().scene.kind === s.kind }}
                disabled={busy() || !!disabledReason(s.kind)}
                title={disabledReason(s.kind) ?? s.hint(m())}
                onClick={() => void pick(s.kind)}
              >
                <i>{s.icon}</i>
                <span class="sk-scene-label">{s.label(m())}</span>
                <span class="sk-scene-hint">{disabledReason(s.kind) ?? s.hint(m())}</span>
              </button>
            )}
          </For>
        </div>
      </article>

      <article class="round sk-card">
        <form class="sk-stack" onSubmit={saveMessage}>
          <h6>{m().announcement}</h6>
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
            <label>{m().shownOnTitle}</label>
          </div>
          <nav class="right-align">
            <button type="button" class="transparent" disabled={busy() || !message()} onClick={() => { setDirty(true); setMessage(""); }}>
              {m().clear}
            </button>
            <button type="submit" class="round" disabled={busy() || !dirty()}>
              <i>campaign</i>
              <span>{m().update}</span>
            </button>
          </nav>
        </form>
      </article>

      <article class="round sk-card">
        <div class="sk-form-row">
          <h6 class="max">{m().preview}</h6>
          <a class="button border round small" href="/live" target="_blank" rel="noopener">
            <i>open_in_new</i>
            <span>{m().openTvPage}</span>
          </a>
        </div>
        <Preview />
      </article>
    </div>
  );
}
