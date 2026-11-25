import { Router, Route, Navigate, type RouteSectionProps } from "@solidjs/router";
import { createEffect, ErrorBoundary, lazy, type Component } from "solid-js";
import { applyLocale, useMessages } from "./lib/i18n";
import { useLive } from "./lib/live";
import { commonMessages } from "./messages";

const RELOAD_KEY = "sk-chunk-reload-at";

/**
 * Lazy page loader that survives a deploy. Each build renames the hashed page
 * chunks, so a tab opened before the deploy asks for files that no longer
 * exist. Reload once to pick up the new build; if that already happened in the
 * last 30 s, let the error reach the ErrorBoundary instead of looping.
 */
function page<T extends { default: Component }>(load: () => Promise<T>) {
  return lazy(() =>
    load().catch((err) => {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          location.reload();
          return new Promise<never>(() => {});
        }
      } catch {
        // storage blocked — fall through to the error screen
      }
      throw err;
    }),
  );
}

const Login = page(() => import("./pages/Login"));
const Me = page(() => import("./pages/Me"));
const Admin = page(() => import("./pages/Admin"));
const Live = page(() => import("./pages/Live"));

function Crashed(props: { error: unknown }) {
  console.error(props.error);
  const m = useMessages(commonMessages);
  return (
    <main class="responsive" style={{ "padding-top": "20vh", "text-align": "center" }}>
      <h5 class="sk-display">{m().crashTitle}</h5>
      <p>{props.error instanceof Error ? props.error.message : m().crashFallback}</p>
      <button class="round" onClick={() => location.reload()}>
        {m().reload}
      </button>
    </main>
  );
}

function Root(props: RouteSectionProps) {
  // Every screen follows the language the admin picked (PublicState.locale).
  const live = useLive();
  const m = useMessages(commonMessages);
  createEffect(() => {
    const l = live.data?.locale;
    if (l) applyLocale(l);
  });
  createEffect(() => {
    document.title = m().appName;
  });
  return <ErrorBoundary fallback={(error) => <Crashed error={error} />}>{props.children}</ErrorBoundary>;
}

export function App() {
  return (
    <Router root={Root}>
      <Route path="/" component={() => <Navigate href="/me" />} />
      <Route path="/login" component={Login} />
      <Route path="/me" component={Me} />
      <Route path="/admin" component={Admin} />
      <Route path="/live" component={Live} />
      <Route path="*" component={() => <Navigate href="/me" />} />
    </Router>
  );
}
