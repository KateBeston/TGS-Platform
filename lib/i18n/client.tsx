'use client';

import { createContext, useContext, useMemo } from 'react';
import { getLocale, type Locale } from './config';

/* The same messages, on the client.
 *
 * Seeded once from the server in the root layout rather than fetched, so there
 * is no flash of English before a translation arrives and no extra request on
 * every page. Client components call useT() and never think about loading.
 */

type Ctx = { locale: Locale; messages: Record<string, unknown> };

const I18nContext = createContext<Ctx>({
  locale: getLocale('en'),
  messages: {},
});

export function I18nProvider({
  locale, messages, children,
}: { locale: string; messages: Record<string, unknown>; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale: getLocale(locale), messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** const t = useT(); t('nav.menu') */
export function useT() {
  const { messages } = useContext(I18nContext);
  return useMemo(() => (key: string): string => {
    const found = key.split('.').reduce<unknown>(
      (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
      messages,
    );
    return typeof found === 'string' ? found : key;
  }, [messages]);
}

/** The active locale, for the picker and for anything that needs dir. */
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
