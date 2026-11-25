// Translations. One language for the whole party, chosen by the admin and
// broadcast in PublicState.locale; Russian by default.
//
// Messages live next to the code that shows them, defined once per area with
// defineMessages({ en, ru }). TypeScript makes `ru` carry exactly the keys of
// `en`, and function messages (interpolation, plurals) keep their parameters.

export const LOCALES = ["ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

type Msg = string | ((...args: never[]) => string);
export type Messages<E> = {
  [K in keyof E]: E[K] extends (...args: infer A) => string ? (...args: A) => string : string;
};

export function defineMessages<E extends Record<string, Msg>>(defs: {
  en: E;
  ru: Messages<E>;
}): Record<Locale, Messages<E>> {
  return defs as unknown as Record<Locale, Messages<E>>;
}

const ruRules = new Intl.PluralRules("ru");

/** Russian plural: ru(1, "звезда", "звезды", "звёзд") → "звезда"; 3 → "звезды"; 5 → "звёзд". */
export function ru(n: number, one: string, few: string, many: string): string {
  const c = ruRules.select(n);
  return c === "one" ? one : c === "few" ? few : many;
}

/** English plural: en(1, "star") → "star"; en(2, "star") → "stars". */
export function en(n: number, one: string, other = `${one}s`): string {
  return n === 1 ? one : other;
}
