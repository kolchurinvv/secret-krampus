import { A, useNavigate } from "@solidjs/router";
import { createEffect, Match, Show, Switch } from "solid-js";
import type { MeState } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { FeedbackHost, toast } from "../components/Feedback";
import { createLiveQuery } from "../components/liveQuery";
import { authClient } from "../lib/auth-client";
import { MatchCard } from "../me/MatchCard";
import { ProfileCard } from "../me/ProfileCard";
import { StarsCard } from "../me/StarsCard";
import { VotingCard } from "../me/VotingCard";
import "../styles/app.css";

export default function Me() {
  const navigate = useNavigate();
  const q = createLiveQuery<MeState>("/api/me");

  createEffect(() => {
    const r = q.result();
    if (r && !r.ok && r.status === 401) navigate("/login", { replace: true });
  });

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch {
      toast("Couldn't sign out — try again.", "error");
      return;
    }
    navigate("/login", { replace: true });
  };

  return (
    <main class="sk-page">
      <Switch fallback={<div class="sk-loading"><progress class="circle" /></div>}>
        <Match when={q.data()}>
          {(me) => (
            <>
              <nav class="sk-topbar">
                <Avatar name={me().participant.name || "?"} url={me().participant.avatarUrl} class="sk-topbar-avatar" />
                <div class="max">
                  <div class="sk-display sk-topbar-title">Secret Krampus</div>
                  <div class="sk-muted small-text sk-ellipsis">{me().participant.name || me().email}</div>
                </div>
                <Show when={me().isAdmin}>
                  <A href="/admin" class="button circle transparent" title="Admin" aria-label="Admin">
                    <i>admin_panel_settings</i>
                  </A>
                </Show>
                <button class="circle transparent" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}>
                  <i>logout</i>
                </button>
              </nav>

              <div class="sk-stack">
                <Show when={!me().participant.name.trim()}>
                  <ProfileCard me={me()} onSaved={q.refetch} highlight />
                </Show>
                <Show when={me().voting.round >= 1 && me().voting.status !== "closed"}>
                  <VotingCard voting={me().voting} onSaved={q.refetch} />
                </Show>
                <MatchCard match={me().match} poolSize={q.live.data?.santa.pool ?? 0} />
                <StarsCard participantId={me().participant.id} live={q.live.data} />
                <Show when={me().participant.name.trim()}>
                  <ProfileCard me={me()} onSaved={q.refetch} />
                </Show>
              </div>
            </>
          )}
        </Match>
        <Match when={(() => { const r = q.result(); return r && !r.ok && r.status !== 401 ? r : undefined; })()}>
          {(err) => (
            <article class="round sk-card">
              <h6>Something went wrong</h6>
              <p class="sk-muted">{err().message}</p>
              <button onClick={q.refetch}>Try again</button>
            </article>
          )}
        </Match>
      </Switch>
      <FeedbackHost />
    </main>
  );
}
