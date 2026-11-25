// One shared EventSource for the whole tab. Every page reads `live` (the latest
// PublicState) and can track `live.version` to refetch its own private data.
import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type { PublicState } from "../../shared/types";

const [state, setState] = createStore<{ data: PublicState | null }>({ data: null });
const [connected, setConnected] = createSignal(false);
/** Offset to convert server timestamps to this browser's clock: local = server + offset. */
const [clockOffset, setClockOffset] = createSignal(0);

let source: EventSource | null = null;

function connect() {
  if (source) return;
  source = new EventSource("/api/live/stream");
  source.addEventListener("open", () => setConnected(true));
  source.addEventListener("state", (ev) => {
    const next = JSON.parse((ev as MessageEvent).data) as PublicState;
    setClockOffset(Date.now() - next.serverNow);
    // reconcile keeps object identity for participants with the same id, so
    // <For> moves existing DOM nodes instead of recreating them (FLIP relies on it).
    setState("data", reconcile(next, { key: "id", merge: true }));
  });
  source.addEventListener("error", () => {
    setConnected(false);
    // EventSource retries on its own; if the browser gave up, start over.
    if (source?.readyState === EventSource.CLOSED) {
      source = null;
      setTimeout(connect, 2000);
    }
  });
}

/** Starts the stream (idempotent) and returns the reactive snapshot holder. */
export function useLive() {
  connect();
  return {
    /** Latest snapshot, or null until the first event arrives. */
    get data() {
      return state.data;
    },
    connected,
    /** Server timestamp (ms) → local Date.now() scale. */
    toLocal: (serverMs: number) => serverMs + clockOffset(),
  };
}
