import { createMemo, For, Match, Show, Switch } from "solid-js";
import { Avatar } from "../components/Avatar";
import { confirmDialog } from "../components/Feedback";
import { api } from "../lib/api";
import { useAdmin } from "./context";

export function KrampusTab() {
  const { state, live, run, busy } = useAdmin();
  const v = () => state().voting;
  const voters = createMemo(() =>
    state()
      .people.filter((p) => p.voting.canVote)
      .sort((a, b) => Number(a.voting.voted) - Number(b.voting.voted) || a.name.localeCompare(b.name)),
  );
  const votedCount = () => voters().filter((p) => p.voting.voted).length;
  const tiedGifts = () => live()?.voting.gifts ?? [];

  const open = async () => {
    const ok = await confirmDialog({
      title: "Open gift rating?",
      message:
        "Everyone's phone shows a star slider for the gift they received. Secret Santa changes are locked while voting runs.",
      confirmLabel: "Open round 1",
    });
    if (ok) await run(() => api.post("/api/admin/voting/open"), "Voting is open 🗳️");
  };

  const closeRound = async () => {
    const missing = voters().length - votedCount();
    const ok = await confirmDialog({
      title: `Close round ${v().round} now?`,
      message: missing
        ? `${missing} ${missing === 1 ? "person hasn't" : "people haven't"} voted — their missing ratings are skipped.`
        : "Everyone has voted.",
      confirmLabel: "Close round",
    });
    if (ok) await run(() => api.post("/api/admin/voting/close-round"), "Round closed");
  };

  const reveal = async () => {
    const ok = await confirmDialog({
      title: "Reveal the Secret Krampus on the TV?",
      message: "Make sure the TV is on and the sound is unlocked. 🎺😈",
      confirmLabel: "Reveal!",
    });
    if (ok) await run(() => api.post("/api/admin/scene", { kind: "krampus" }), "Revealing on the TV…");
  };

  const reset = async () => {
    const ok = await confirmDialog({
      title: "Reset Krampus voting?",
      message: "All ratings from every round are deleted and the Secret Santa unlocks. This can't be undone.",
      confirmLabel: "Reset voting",
      danger: true,
    });
    if (ok) await run(() => api.post("/api/admin/voting/reset"), "Voting reset");
  };

  return (
    <div class="sk-stack">
      <article class="round sk-card">
        <h6>Secret Krampus vote</h6>
        <Switch>
          <Match when={v().round === 0 || v().status === "closed"}>
            <p class="sk-muted">
              Round 1: each person rates the gift they received (½-star steps). If the lowest gifts tie, a tie-break
              round where everyone votes opens automatically.
            </p>
            <button
              class="round large responsive"
              disabled={busy() || state().santa.assigned === 0}
              onClick={() => void open()}
            >
              <i>how_to_vote</i>
              <span>Open voting (round 1)</span>
            </button>
            <Show when={state().santa.assigned === 0}>
              <p class="sk-muted small-text center-align">Assign the Secret Santa first.</p>
            </Show>
          </Match>
          <Match when={v().status === "open"}>
            <div class="sk-chips">
              <span class="chip fill">{v().round === 1 ? "Round 1 · recipients rate" : `Tie-break · round ${v().round}`}</span>
              <span class="chip">
                {votedCount()} / {voters().length} voted
              </span>
            </div>
            <progress class="sk-top-gap" value={votedCount()} max={Math.max(1, voters().length)} />
            <Show when={v().round >= 2 && tiedGifts().length > 0}>
              <p class="sk-muted small-text">Tied gifts:</p>
              <div class="sk-chips">
                <For each={tiedGifts()}>
                  {(g) => <span class="chip small">🎁 {g.forName}'s gift</span>}
                </For>
              </div>
            </Show>
            <button class="round border responsive sk-top-gap" disabled={busy()} onClick={() => void closeRound()}>
              <i>stop_circle</i>
              <span>Close round now</span>
            </button>
          </Match>
          <Match when={v().status === "done"}>
            <div class="sk-krampus-ready">
              <div class="sk-big-emoji" aria-hidden="true">
                🤫
              </div>
              <Show
                when={v().hasResult}
                fallback={<p>Voting finished, but no gift got a rating — reset and try again.</p>}
              >
                <p>
                  <strong>The Krampus has been decided.</strong> Even you don't know who it is yet.
                </p>
              </Show>
            </div>
            <Show when={v().hasResult}>
              <button class="round large responsive" disabled={busy()} onClick={() => void reveal()}>
                <i>theaters</i>
                <span>{v().revealed ? "Show the reveal on TV again" : "Reveal on TV 😈"}</span>
              </button>
            </Show>
          </Match>
        </Switch>
      </article>

      <Show when={v().status === "open"}>
        <article class="round sk-card no-padding">
          <h6 class="sk-list-title">Who has voted</h6>
          <ul class="sk-people">
            <For each={voters()} fallback={<li class="sk-empty">Nobody can vote this round.</li>}>
              {(p) => (
                <li class="sk-person sk-person-compact">
                  <Avatar name={p.name} url={p.avatarUrl} class="sk-person-avatar-sm" />
                  <div class="max sk-ellipsis">{p.name}</div>
                  <span class="chip small" classList={{ fill: p.voting.voted }}>
                    {p.voting.voted ? "✓ voted" : "⏳ not yet"}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </article>
      </Show>

      <Show when={v().round > 0}>
        <article class="round sk-card sk-danger">
          <h6>Danger zone</h6>
          <button class="round error" disabled={busy()} onClick={() => void reset()}>
            <i>restart_alt</i>
            <span>Reset voting</span>
          </button>
        </article>
      </Show>
    </div>
  );
}
