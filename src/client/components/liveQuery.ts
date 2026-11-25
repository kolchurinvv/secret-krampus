import { createEffect, createResource } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { api, ApiError } from "../lib/api";
import { useLive } from "../lib/live";

export type QueryResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

/**
 * Fetches a private JSON endpoint and refetches it whenever the live SSE
 * snapshot announces a change (live.data.version). Errors are returned as
 * values so callers can react to 401/403 without error boundaries.
 *
 * Successful data is reconciled into a store keyed by `id`, so list items keep
 * their identity across refetches — <For> rows (and any input being typed in)
 * survive an SSE-triggered refresh.
 */
export function createLiveQuery<T extends object>(path: string) {
  const live = useLive();
  const [res, { refetch }] = createResource(
    () => live.data?.version ?? 0,
    async (): Promise<QueryResult<T>> => {
      try {
        return { ok: true, data: await api.get<T>(path) };
      } catch (err) {
        return {
          ok: false,
          status: err instanceof ApiError ? err.status : 0,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
  const [store, setStore] = createStore<{ data: T | undefined }>({ data: undefined });
  createEffect(() => {
    const r = res.latest;
    if (r?.ok) setStore("data", reconcile(r.data, { key: "id", merge: true }) as never);
  });
  return {
    result: () => res.latest,
    data: (): T | undefined => store.data as T | undefined,
    refetch: () => void refetch(),
    live,
  };
}
