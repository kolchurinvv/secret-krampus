import { createMemo, For, Match, Show, Switch } from "solid-js";
import { Avatar } from "../components/Avatar";
import { confirmDialog } from "../components/Feedback";
import { api } from "../lib/api";
import { useMessages } from "../lib/i18n";
import { useAdmin } from "./context";
import { adminMessages } from "./messages";

export function KrampusTab() {
  const { state, live, run, busy } = useAdmin();
  const m = useMessages(adminMessages);
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
      title: m().openVotingTitle,
      message: m().openVotingMessage,
      confirmLabel: m().openRoundOne,
    });
    if (ok) await run(() => api.post("/api/admin/voting/open"), m().votingOpened);
  };

  const closeRound = async () => {
    const missing = voters().length - votedCount();
    const ok = await confirmDialog({
      title: m().closeRoundTitle(v().round),
      message: missing ? m().closeRoundMissing(missing) : m().everyoneVoted,
      confirmLabel: m().closeRound,
    });
    if (ok) await run(() => api.post("/api/admin/voting/close-round"), m().roundClosed);
  };

  const reveal = async () => {
    const ok = await confirmDialog({
      title: m().revealTitle,
      message: m().revealMessage,
      confirmLabel: m().revealConfirm,
    });
    if (ok) await run(() => api.post("/api/admin/scene", { kind: "krampus" }), m().revealing);
  };

  const reset = async () => {
    const ok = await confirmDialog({
      title: m().resetTitle,
      message: m().resetMessage,
      confirmLabel: m().resetVoting,
      danger: true,
    });
    if (ok) await run(() => api.post("/api/admin/voting/reset"), m().votingReset);
  };

  return (
    <div class="sk-stack">
      <article class="round sk-card">
        <h6>{m().voteTitle}</h6>
        <Switch>
          <Match when={v().round === 0 || v().status === "closed"}>
            <p class="sk-muted">{m().voteIntro}</p>
            <button
              class="round large responsive"
              disabled={busy() || state().santa.assigned === 0}
              onClick={() => void open()}
            >
              <i>how_to_vote</i>
              <span>{m().openVoting}</span>
            </button>
            <Show when={state().santa.assigned === 0}>
              <p class="sk-muted small-text center-align">{m().assignSantaFirst}</p>
            </Show>
          </Match>
          <Match when={v().status === "open"}>
            <div class="sk-chips">
              <span class="chip fill">{v().round === 1 ? m().roundOneChip : m().tieBreakChip(v().round)}</span>
              <span class="chip">{m().votedOf(votedCount(), voters().length)}</span>
            </div>
            <progress class="sk-top-gap" value={votedCount()} max={Math.max(1, voters().length)} />
            <Show when={v().round >= 2 && tiedGifts().length > 0}>
              <p class="sk-muted small-text">{m().tiedGifts}</p>
              <div class="sk-chips">
                <For each={tiedGifts()}>
                  {(g) => <span class="chip small">{m().giftFor(g.forName)}</span>}
                </For>
              </div>
            </Show>
            <button class="round border responsive sk-top-gap" disabled={busy()} onClick={() => void closeRound()}>
              <i>stop_circle</i>
              <span>{m().closeRoundNow}</span>
            </button>
          </Match>
          <Match when={v().status === "done"}>
            <div class="sk-krampus-ready">
              <div class="sk-big-emoji" aria-hidden="true">
                🤫
              </div>
              <Show
                when={v().hasResult}
                fallback={<p>{m().noRatings}</p>}
              >
                <p>
                  <strong>{m().krampusDecided}</strong>
                  {m().krampusDecidedHint}
                </p>
              </Show>
            </div>
            <Show when={v().hasResult}>
              <button class="round large responsive" disabled={busy()} onClick={() => void reveal()}>
                <i>theaters</i>
                <span>{v().revealed ? m().revealAgain : m().revealOnTv}</span>
              </button>
            </Show>
          </Match>
        </Switch>
      </article>

      <Show when={v().status === "open"}>
        <article class="round sk-card no-padding">
          <h6 class="sk-list-title">{m().whoVoted}</h6>
          <ul class="sk-people">
            <For each={voters()} fallback={<li class="sk-empty">{m().nobodyCanVote}</li>}>
              {(p) => (
                <li class="sk-person sk-person-compact">
                  <Avatar name={p.name} url={p.avatarUrl} class="sk-person-avatar-sm" />
                  <div class="max sk-ellipsis">{p.name}</div>
                  <span class="chip small" classList={{ fill: p.voting.voted }}>
                    {p.voting.voted ? m().votedChip : m().notYetChip}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </article>
      </Show>

      <Show when={v().round > 0}>
        <article class="round sk-card sk-danger">
          <h6>{m().dangerZone}</h6>
          <button class="round error" disabled={busy()} onClick={() => void reset()}>
            <i>restart_alt</i>
            <span>{m().resetVoting}</span>
          </button>
        </article>
      </Show>
    </div>
  );
}
