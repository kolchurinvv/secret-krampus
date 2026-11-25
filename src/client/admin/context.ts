import { createContext, createSignal, useContext } from "solid-js";
import type { AdminState, PublicState } from "../../shared/types";
import { errorMessage, toast } from "../components/Feedback";
import { intlLocale, locale } from "../lib/i18n";
import { adminMessages } from "./messages";

export type AdminCtx = {
  state: () => AdminState;
  live: () => PublicState | null;
  refetch: () => void;
  /** Runs a mutation with busy tracking, an error toast, an optional success toast, then refetches. */
  run: <T>(fn: () => Promise<T>, success?: string | ((r: T) => string)) => Promise<T | undefined>;
  busy: () => boolean;
};

export const AdminContext = createContext<AdminCtx>();

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin outside <AdminContext.Provider>");
  return ctx;
}

export function createRunner(refetch: () => void) {
  const [pending, setPending] = createSignal(0);
  const run = async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)) => {
    setPending((n) => n + 1);
    try {
      const r = await fn();
      if (success) toast(typeof success === "function" ? success(r) : success);
      return r;
    } catch (err) {
      toast(errorMessage(err), "error");
      return undefined;
    } finally {
      setPending((n) => n - 1);
      refetch();
    }
  };
  return { run, busy: () => pending() > 0 };
}

/** Server responses may give id arrays or counts; normalise to a count. */
export function countOf(x: unknown): number {
  return Array.isArray(x) ? x.length : typeof x === "number" ? x : 0;
}

/** "just now" / "5 min ago" / "2 h ago" / "24 Nov", in the app's language. */
export function timeAgo(ms: number) {
  const m = adminMessages[locale()];
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return m.justNow;
  if (s < 3600) return m.minutesAgo(Math.round(s / 60));
  if (s < 86400) return m.hoursAgo(Math.round(s / 3600));
  return new Date(ms).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" });
}
