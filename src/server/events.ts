// In-process change notifications. Every mutation calls notify(); listeners
// (the SSE streams) run once per burst of changes, ~30 ms after the last call
// started the burst.
import { sqlite } from "./db";

type Listener = (version: number) => void;

const listeners = new Set<Listener>();
let version = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

export function currentVersion() {
  return version;
}

export function notify() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    version++;
    for (const l of listeners) {
      try {
        l(version);
      } catch (err) {
        console.error("listener failed", err);
      }
    }
  }, 30);
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Pick up writes made by OTHER connections (the seed/simulate script, or a
// hand edit in sqlite3): PRAGMA data_version changes only when another
// connection commits.
let lastDataVersion = -1;
const poll = setInterval(() => {
  const row = sqlite.query("PRAGMA data_version").get() as { data_version: number } | null;
  const v = row?.data_version ?? 0;
  if (lastDataVersion !== -1 && v !== lastDataVersion) notify();
  lastDataVersion = v;
}, 1000);
poll.unref?.();
