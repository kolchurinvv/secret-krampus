import { A, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, Match, Show, Switch } from "solid-js";
import { LOCALES, type Locale } from "../../shared/i18n";
import type { AdminState } from "../../shared/types";
import { ContestsTab } from "../admin/ContestsTab";
import { AdminContext, createRunner } from "../admin/context";
import { KrampusTab } from "../admin/KrampusTab";
import { PeopleTab } from "../admin/PeopleTab";
import { SantaTab } from "../admin/SantaTab";
import { TvTab } from "../admin/TvTab";
import { adminMessages, type AdminMessages } from "../admin/messages";
import { FeedbackHost } from "../components/Feedback";
import { createLiveQuery } from "../components/liveQuery";
import { api } from "../lib/api";
import { locale, useMessages } from "../lib/i18n";
import "../styles/app.css";

const TABS = [
  { id: "people", icon: "group", label: (m: AdminMessages) => m.tabPeople },
  { id: "santa", icon: "redeem", label: (m: AdminMessages) => m.tabSanta },
  { id: "krampus", icon: "sentiment_very_dissatisfied", label: (m: AdminMessages) => m.tabKrampus },
  { id: "contests", icon: "emoji_events", label: (m: AdminMessages) => m.tabContests },
  { id: "tv", icon: "tv", label: (m: AdminMessages) => m.tabTv },
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
  const m = useMessages(adminMessages);
  /** The app-wide language: what the live state says, else what this tab is showing. */
  const currentLocale = () => q.live.data?.locale ?? locale();
  const switchLocale = (l: Locale) => {
    if (l === currentLocale()) return;
    // Toast in the language being switched to.
    void run(() => api.post("/api/admin/locale", { locale: l }), adminMessages[l].languageSwitched);
  };

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
          <div class="sk-display sk-topbar-title">{m().hqTitle}</div>
          <div class="sk-muted small-text">
            {q.live.connected() ? m().statusLive : m().statusReconnecting}
            {q.data()
              ? ` · ${q.data()!.emailMode === "console" ? m().statusEmailsConsole : m().statusEmailsResend} · ${q.data()!.storageMode === "local" ? m().statusAvatarsLocal : m().statusAvatarsR2}`
              : ""}
          </div>
        </div>
        <Show when={q.data()}>
          <nav class="no-space sk-lang" role="group" aria-label={m().language} title={m().languageTitle}>
            <For each={LOCALES}>
              {(l, i) => (
                <button
                  type="button"
                  class="border small"
                  classList={{
                    fill: currentLocale() === l,
                    "left-round": i() === 0,
                    "right-round": i() === LOCALES.length - 1,
                  }}
                  aria-pressed={currentLocale() === l}
                  disabled={busy()}
                  onClick={() => switchLocale(l)}
                >
                  {l.toUpperCase()}
                </button>
              )}
            </For>
          </nav>
        </Show>
        <a class="button circle transparent" href="/live" target="_blank" rel="noopener" title={m().openTvPage} aria-label={m().openTvPage}>
          <i>tv</i>
        </a>
        <A href="/me" class="button circle transparent" title={m().myPage} aria-label={m().myPage}>
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
                      <span>{t.label(m())}</span>
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
            <h6>{m().notAdminTitle}</h6>
            <p class="sk-muted">{m().notAdminText}</p>
            <A href="/me" class="button round">
              {m().backToMyPage}
            </A>
          </article>
        </Match>
        <Match when={failure()}>
          {(err) => (
            <article class="round sk-card">
              <h6>{m().somethingWrong}</h6>
              <p class="sk-muted">{err().message}</p>
              <button onClick={q.refetch}>{m().tryAgain}</button>
            </article>
          )}
        </Match>
      </Switch>
      <FeedbackHost />
    </main>
  );
}
