import { createEffect, createSignal, For, Match, on, onCleanup, Show, Switch } from "solid-js";
import type { MeState, MeVoteTask } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { errorMessage, toast } from "../components/Feedback";
import { StarSlider } from "../components/StarSlider";
import { api } from "../lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

function VoteTask(props: { task: MeVoteTask; round: number; onSaved: () => void }) {
  // Local value wins while the user is interacting; otherwise show the server's.
  const [local, setLocal] = createSignal<number | null>(null);
  const [state, setState] = createSignal<SaveState>("idle");
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
          <strong>{props.task.isMine ? "The gift you received" : `${props.task.forName}'s gift`}</strong>
        </div>
        <span class="sk-save-state" aria-live="polite">
          <Switch>
            <Match when={state() === "saving"}>saving…</Match>
            <Match when={state() === "saved"}>saved ✓</Match>
            <Match when={state() === "error"}>not saved</Match>
            <Match when={props.task.score !== null && local() === null}>saved ✓</Match>
          </Switch>
        </span>
      </div>
      <StarSlider
        value={value()}
        onChange={onChange}
        label={props.task.isMine ? "Rate the gift you received" : `Rate ${props.task.forName}'s gift`}
      />
    </div>
  );
}

export function VotingCard(props: { voting: MeState["voting"]; onSaved: () => void }) {
  const v = () => props.voting;
  return (
    <article class="round sk-card sk-card-highlight">
      <Switch>
        <Match when={v().status === "done"}>
          <h5 class="sk-display">Votes are in! 📺</h5>
          <p>Watch the TV — the Secret Krampus will be revealed soon…</p>
        </Match>
        <Match when={v().status === "open" && v().round === 1}>
          <h5 class="sk-display">Rate the gift you received</h5>
          <p class="sk-muted sk-m0">Be honest — the lowest-rated gift crowns the Secret Krampus 😈</p>
        </Match>
        <Match when={v().status === "open" && v().round >= 2}>
          <h5 class="sk-display">It's a tie! 😬</h5>
          <p class="sk-muted sk-m0">
            Round {v().round}: everyone rates these gifts. Lowest average gets the horns.
          </p>
        </Match>
      </Switch>
      <Show when={v().status === "open"}>
        <Show
          when={v().tasks.length > 0}
          fallback={<p class="sk-muted">Nothing for you to rate this round — sit back and enjoy the show 🍪</p>}
        >
          <div class="sk-stack sk-vote-list">
            <For each={v().tasks}>
              {(task) => <VoteTask task={task} round={v().round} onSaved={props.onSaved} />}
            </For>
          </div>
          <p class="sk-muted small-text sk-m0">You can change your rating until the round closes.</p>
        </Show>
      </Show>
    </article>
  );
}
