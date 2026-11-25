import { A, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, Match, Switch } from "solid-js";
import type { AdminState } from "../../shared/types";
import { ContestsTab } from "../admin/ContestsTab";
import { AdminContext, createRunner } from "../admin/context";
import { KrampusTab } from "../admin/KrampusTab";
import { PeopleTab } from "../admin/PeopleTab";
import { SantaTab } from "../admin/SantaTab";
import { TvTab } from "../admin/TvTab";
import { FeedbackHost } from "../components/Feedback";
import { createLiveQuery } from "../components/liveQuery";
import "../styles/app.css";

const TABS = [
  { id: "people", icon: "group", label: "People" },
  { id: "santa", icon: "redeem", label: "Santa" },
  { id: "krampus", icon: "sentiment_very_dissatisfied", label: "Krampus" },
  { id: "contests", icon: "emoji_events", label: "Contests" },
  { id: "tv", icon: "tv", label: "TV" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TAB_KEY = "sk-admin-tab";

function loadTab(): TabId {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (TABS.some((t) => t.id === v)) return v as TabId;
  } catch {
    /* storage unavailable */
  }
  return "contests";
}

export default function Admin() {
  const navigate = useNavigate();
  const q = createLiveQuery<AdminState>("/api/admin/state");
  const { run, busy } = createRunner(q.refetch);
  const [tab, setTab] = createSignal<TabId>(loadTab());

  const selectTab = (id: TabId) => {
    setTab(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  };

  createEffect(() => {
    const r = q.result();
    if (r && !r.ok && r.status === 401) navigate("/login", { replace: true });
  });

  const failure = () => {
    const r = q.result();
    return r && !r.ok && r.status !== 401 ? r : undefined;
  };

  return (
    <main class="sk-page sk-admin">
      <nav class="sk-topbar">
        <div class="max">
          <div class="sk-display sk-topbar-title">Krampus HQ</div>
          <div class="sk-muted small-text">
            {q.live.connected() ? "● live" : "○ reconnecting…"}
            {q.data() ? ` · ${q.data()!.emailMode === "console" ? "emails → console" : "Resend"} · ${q.data()!.storageMode === "local" ? "local avatars" : "R2"}` : ""}
          </div>
        </div>
        <a class="button circle transparent" href="/live" target="_blank" rel="noopener" title="Open TV page" aria-label="Open TV page">
          <i>tv</i>
        </a>
        <A href="/me" class="button circle transparent" title="My page" aria-label="My page">
          <i>person</i>
        </A>
      </nav>

      <Switch fallback={<div class="sk-loading"><progress class="circle" /></div>}>
        <Match when={q.data()}>
          {(state) => (
            <AdminContext.Provider value={{ state, live: () => q.live.data, refetch: q.refetch, run, busy }}>
              <div class="tabs sk-tabs" role="tablist">
                <For each={TABS}>
                  {(t) => (
                    <a
                      role="tab"
                      href={`#${t.id}`}
                      aria-selected={tab() === t.id}
                      classList={{ active: tab() === t.id }}
                      onClick={(e) => {
                        e.preventDefault();
                        selectTab(t.id);
                      }}
                    >
                      <i>{t.icon}</i>
                      <span>{t.label}</span>
                    </a>
                  )}
                </For>
              </div>
              <div class="sk-tab-body">
                <Switch>
                  <Match when={tab() === "people"}>
                    <PeopleTab />
                  </Match>
                  <Match when={tab() === "santa"}>
                    <SantaTab />
                  </Match>
                  <Match when={tab() === "krampus"}>
                    <KrampusTab />
                  </Match>
                  <Match when={tab() === "contests"}>
                    <ContestsTab />
                  </Match>
                  <Match when={tab() === "tv"}>
                    <TvTab />
                  </Match>
                </Switch>
              </div>
            </AdminContext.Provider>
          )}
        </Match>
        <Match when={failure()?.status === 403}>
          <article class="round sk-card center-align">
            <div class="sk-big-emoji" aria-hidden="true">
              🚫🎅
            </div>
            <h6>You're not an admin</h6>
            <p class="sk-muted">Only the party organisers can see Krampus HQ.</p>
            <A href="/me" class="button round">
              Back to my page
            </A>
          </article>
        </Match>
        <Match when={failure()}>
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
