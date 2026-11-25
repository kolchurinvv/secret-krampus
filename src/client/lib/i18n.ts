// The app-wide language on the client. The admin picks it; it arrives with the
// live state (PublicState.locale) and is cached in localStorage so a reload
// doesn't flash the other language first.
import { createSignal } from "solid-js";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../../shared/i18n";

const KEY = "sk-locale";

function cached(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    if (isLocale(v)) return v;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_LOCALE;
}

const [locale, setLocaleSignal] = createSignal<Locale>(cached());
document.documentElement.lang = locale();

/** The current language (reactive). */
export { locale };

export function applyLocale(l: Locale) {
  if (l === locale()) return;
  setLocaleSignal(l);
  document.documentElement.lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
}

/**
 * Reactive accessor for an area's messages:
 *   const m = useMessages(tvMessages);  …  <h1>{m().title}</h1>  {m().stars(n)}
 */
export function useMessages<M>(defs: Record<Locale, M>): () => M {
  return () => defs[locale()];
}

/** Locale tag for Intl APIs (dates, numbers, relative time). */
export const intlLocale = () => (locale() === "ru" ? "ru-RU" : "en-GB");
