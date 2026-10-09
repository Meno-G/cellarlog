// The app's language: English or Georgian. lib/ builds its messages in the
// current language (strings().messages), and screens re-render on a change
// through useLanguage() (hooks/useLanguage.ts). Pure apart from the key-value store.
import { z } from 'zod';

import { readJson, writeJson } from '../storage';
import { en, type Strings } from './en';
import { ka } from './ka';

export type { Strings };
export type Lang = 'en' | 'ka';

export const LANGS: readonly Lang[] = ['en', 'ka'];

const STRINGS: Record<Lang, Strings> = { en, ka };

let current: Lang = 'en';
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  for (const listener of listeners) listener();
}

/** For useSyncExternalStore. Returns an unsubscribe function. */
export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The texts of the current language. */
export function strings(): Strings {
  return STRINGS[current];
}

export function stringsFor(lang: Lang): Strings {
  return STRINGS[lang];
}

/** A stored value name ("TA", "Free SO2") as shown in the current language. Unknown names as typed. */
export function itemName(name: string): string {
  return strings().items[name.trim().toLowerCase()] ?? name;
}

/** A stored unit ("g/L") as shown in the current language. */
export function unitName(unit: string): string {
  return strings().units[unit] ?? unit;
}

/** "ka-GE", "ka" -> Georgian; anything else -> English. */
export function langFromLocale(locale: string | undefined): Lang {
  return locale?.toLowerCase().startsWith('ka') ? 'ka' : 'en';
}

// The choice is per phone, not per account: it also applies on the sign-in screen.
const LANG_KEY = 'cellarlog:v1:language';
const langSchema = z.enum(['en', 'ka']);

/** The saved choice, or the phone's language the first time. Sets it as current. */
export function loadLang(deviceLocale: string | undefined): Lang {
  const lang = readJson(LANG_KEY, langSchema) ?? langFromLocale(deviceLocale);
  setLang(lang);
  return lang;
}

/** Switches the language and remembers it on this phone. */
export function chooseLang(lang: Lang): void {
  writeJson(LANG_KEY, lang);
  setLang(lang);
}
