import { createSignal, Match, Show, Switch } from "solid-js";
import type { MeState } from "../../shared/types";
import { Avatar } from "../components/Avatar";

export function MatchCard(props: { match: MeState["match"]; poolSize: number }) {
  const [revealed, setRevealed] = createSignal(false);

  return (
    <article class="round sk-card">
      <h6>Your Secret Santa match</h6>
      <Switch>
        <Match when={props.match.state === "not-in-santa"}>
          <p class="sk-muted">
            You're not in the Secret Santa draw this time — but you can still win contest stars ⭐
          </p>
        </Match>
        <Match when={props.match.state === "waiting"}>
          <div class="sk-match-waiting">
            <div class="sk-big-emoji" aria-hidden="true">
              🧝
            </div>
            <p>
              The elves haven't drawn your name yet.{" "}
              <strong>
                {props.poolSize} {props.poolSize === 1 ? "person has" : "people have"}
              </strong>{" "}
              signed up so far. You'll get an email when it's done.
            </p>
          </div>
        </Match>
        <Match when={props.match.state === "assigned" && props.match}>
          {(m) => (
            <>
              <Show when={m().changed}>
                <p class="sk-note">
                  🔀 <strong>Plot twist!</strong> Your match changed on{" "}
                  {new Date(m().assignedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} because
                  someone joined late.
                </p>
              </Show>
              <Show
                when={revealed()}
                fallback={
                  <button class="sk-reveal" type="button" onClick={() => setRevealed(true)}>
                    <span class="sk-big-emoji" aria-hidden="true">
                      🎁
                    </span>
                    <span>Tap to reveal who you're gifting</span>
                    <span class="sk-muted small-text">Make sure nobody's peeking 👀</span>
                  </button>
                }
              >
                <div class="sk-match">
                  <Avatar name={m().receiver.name} url={m().receiver.avatarUrl} class="sk-match-avatar" />
                  <div class="max">
                    <div class="sk-muted small-text">You're gifting</div>
                    <div class="sk-display sk-match-name">{m().receiver.name}</div>
                  </div>
                  <button
                    class="circle transparent"
                    type="button"
                    title="Hide"
                    aria-label="Hide match"
                    onClick={() => setRevealed(false)}
                  >
                    <i>visibility_off</i>
                  </button>
                </div>
                <div class="sk-wishlist">
                  <div class="sk-muted small-text">Their wishlist</div>
                  <Show when={m().receiver.wishlist.trim()} fallback={<p class="sk-muted">No wishlist yet — improvise! 🎲</p>}>
                    <p class="sk-prewrap">{m().receiver.wishlist}</p>
                  </Show>
                </div>
              </Show>
            </>
          )}
        </Match>
      </Switch>
    </article>
  );
}
