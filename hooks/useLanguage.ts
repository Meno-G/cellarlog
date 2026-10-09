import { useSyncExternalStore } from 'react';

import { chooseLang, getLang, stringsFor, subscribeLang, type Lang, type Strings } from '@/lib/i18n';

/**
 * The current language and its texts. Every component that shows text calls
 * this (or useT), so switching the language re-renders it at once.
 */
export function useLanguage(): { lang: Lang; t: Strings; setLang: (lang: Lang) => void } {
  const lang = useSyncExternalStore(subscribeLang, getLang);
  return { lang, t: stringsFor(lang), setLang: chooseLang };
}

/** The texts of the current language. */
export function useT(): Strings {
  return useLanguage().t;
}
