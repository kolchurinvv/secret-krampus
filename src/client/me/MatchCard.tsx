import { createSignal, Match, Show, Switch } from "solid-js";
import type { MeState } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { intlLocale, useMessages } from "../lib/i18n";
import { meMessages } from "./messages";

export function MatchCard(props: { match: MeState["match"]; poolSize: number }) {
  const [revealed, setRevealed] = createSignal(false);
  const t = useMessages(meMessages);

  return (
    <article class="round sk-card">
      <h6>{t().matchTitle}</h6>
      <Switch>
        <Match when={props.match.state === "not-in-santa"}>
          <p class="sk-muted">{t().notInSanta}</p>
        </Match>
        <Match when={props.match.state === "waiting"}>
          <div class="sk-match-waiting">
            <div class="sk-big-emoji" aria-hidden="true">
              🧝
            </div>
            <p>
              {t().waitingLead} <strong>{t().signedUp(props.poolSize)}</strong> {t().waitingTail}
            </p>
          </div>
        </Match>
        <Match when={props.match.state === "assigned" && props.match}>
          {(m) => (
            <>
              <Show when={m().changed}>
                <p class="sk-note">
                  🔀 <strong>{t().plotTwist}</strong>{" "}
                  {t().matchChanged(
                    new Date(m().assignedAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" }),
                  )}
                </p>
              </Show>
              <Show
                when={revealed()}
                fallback={
                  <button class="sk-reveal" type="button" onClick={() => setRevealed(true)}>
                    <span class="sk-big-emoji" aria-hidden="true">
                      🎁
                    </span>
                    <span>{t().tapToReveal}</span>
                    <span class="sk-muted small-text">{t().noPeeking}</span>
                  </button>
                }
              >
                <div class="sk-match">
                  <Avatar name={m().receiver.name} url={m().receiver.avatarUrl} class="sk-match-avatar" />
                  <div class="max">
                    <div class="sk-muted small-text">{t().youreGifting}</div>
                    <div class="sk-display sk-match-name">{m().receiver.name}</div>
                  </div>
                  <button
                    class="circle transparent"
                    type="button"
                    title={t().hide}
                    aria-label={t().hideMatch}
                    onClick={() => setRevealed(false)}
                  >
                    <i>visibility_off</i>
                  </button>
                </div>
                <div class="sk-wishlist">
                  <div class="sk-muted small-text">{t().theirWishlist}</div>
                  <Show when={m().receiver.wishlist.trim()} fallback={<p class="sk-muted">{t().noWishlist}</p>}>
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
