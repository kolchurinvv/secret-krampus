import { createEffect, createSignal, For, Match, on, onCleanup, Show, Switch } from "solid-js";
import type { MeState, MeVoteTask } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { errorMessage, toast } from "../components/Feedback";
import { StarSlider } from "../components/StarSlider";
import { api } from "../lib/api";
import { useMessages } from "../lib/i18n";
import { meMessages } from "./messages";

type SaveState = "idle" | "saving" | "saved" | "error";

function VoteTask(props: { task: MeVoteTask; round: number; onSaved: () => void }) {
  // Local value wins while the user is interacting; otherwise show the server's.
  const [local, setLocal] = createSignal<number | null>(null);
  const [state, setState] = createSignal<SaveState>("idle");
  const m = useMessages(meMessages);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  // The store reuses list items by position, so the same component can be
  // handed a different gift when a tie-break round starts: start fresh then.
  createEffect(
    on(
      () => `${props.round}:${props.task.forId}`,
      () => {
        clearTimeout(timer);
        setLocal(null);
        setState("idle");
      },
      { defer: true },
    ),
  );

  const value = () => local() ?? props.task.score;

  const send = async (forId: string, score: number) => {
    setState("saving");
    try {
      await api.post("/api/me/vote", { forId, score });
      setState("saved");
      props.onSaved();
    } catch (err) {
      setState("error");
      toast(errorMessage(err), "error");
    }
  };

  const onChange = (score: number) => {
    setLocal(score);
    setState("idle");
    clearTimeout(timer);
    const forId = props.task.forId;
    timer = setTimeout(() => void send(forId, score), 450);
  };

  return (
    <div class="sk-vote-task">
      <div class="sk-vote-head">
        <Show
          when={!props.task.isMine}
          fallback={
            <span class="sk-big-emoji" aria-hidden="true">
              🎁
            </span>
          }
        >
          <Avatar name={props.task.forName} url={props.task.forAvatarUrl} class="sk-vote-avatar" />
        </Show>
        <div class="max">
          <strong>{props.task.isMine ? m().myGift : m().giftFor(props.task.forName)}</strong>
        </div>
        <span class="sk-save-state" aria-live="polite">
          <Switch>
            <Match when={state() === "saving"}>{m().stateSaving}</Match>
            <Match when={state() === "saved"}>{m().stateSaved}</Match>
            <Match when={state() === "error"}>{m().stateError}</Match>
            <Match when={props.task.score !== null && local() === null}>{m().stateSaved}</Match>
          </Switch>
        </span>
      </div>
      <StarSlider
        value={value()}
        onChange={onChange}
        label={props.task.isMine ? m().rateMine : m().rateFor(props.task.forName)}
      />
    </div>
  );
}

export function VotingCard(props: { voting: MeState["voting"]; onSaved: () => void }) {
  const v = () => props.voting;
  const m = useMessages(meMessages);
  return (
    <article class="round sk-card sk-card-highlight">
      <Switch>
        <Match when={v().status === "done"}>
          <h5 class="sk-display">{m().votesIn}</h5>
          <p>{m().watchTv}</p>
        </Match>
        <Match when={v().status === "open" && v().round === 1}>
          <h5 class="sk-display">{m().rateMine}</h5>
          <p class="sk-muted sk-m0">{m().beHonest}</p>
        </Match>
        <Match when={v().status === "open" && v().round >= 2}>
          <h5 class="sk-display">{m().tie}</h5>
          <p class="sk-muted sk-m0">{m().tieRound(v().round)}</p>
        </Match>
      </Switch>
      <Show when={v().status === "open"}>
        <Show
          when={v().tasks.length > 0}
          fallback={<p class="sk-muted">{m().nothingToRate}</p>}
        >
          <div class="sk-stack sk-vote-list">
            <For each={v().tasks}>
              {(task) => <VoteTask task={task} round={v().round} onSaved={props.onSaved} />}
            </For>
          </div>
          <p class="sk-muted small-text sk-m0">{m().canChange}</p>
        </Show>
      </Show>
    </article>
  );
}
