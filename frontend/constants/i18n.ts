import en from "./en.json";
import zh from "./zh.json";

export const DEFAULT_LOCALE = "en";
export const LOCALE_STORAGE_KEY = "crisprdb-locale";

export type Locale = "en" | "zh";
export type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = { en, zh };

export function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "zh";
}

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
