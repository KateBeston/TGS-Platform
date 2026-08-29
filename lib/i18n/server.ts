import { headers, cookies } from 'next/headers';
import { DEFAULT_LOCALE, getLocale, type Locale } from './config';
import en from '@/messages/en.json';

/* Reading and using a locale on the server.
 *
 * The locale arrives as a request header set by proxy.ts, which is how a
 * prefixed URL such as /fr/venues reaches the unprefixed route tree without a
 * single route being moved. The cookie is the fallback for anything the proxy
 * did not touch.
 */

export type Messages = typeof en;

const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  en: () => import('@/messages/en.json'),
  fr: () => import('@/messages/fr.json'),
  es: () => import('@/messages/es.json'),
  it: () => import('@/messages/it.json'),
  pt: () => import('@/messages/pt.json'),
  de: () => import('@/messages/de.json'),
  ja: () => import('@/messages/ja.json'),
  zh: () => import('@/messages/zh.json'),
  ru: () => import('@/messages/ru.json'),
  tr: () => import('@/messages/tr.json'),
  vi: () => import('@/messages/vi.json'),
  ar: () => import('@/messages/ar.json'),
  he: () => import('@/messages/he.json'),
};

/** The locale for this request. */
export async function currentLocale(): Promise<Locale> {
  const h = await headers();
  const fromHeader = h.get('x-tgs-locale');
  if (fromHeader) return getLocale(fromHeader);

  const c = await cookies();
  return getLocale(c.get('tgs_locale')?.value ?? DEFAULT_LOCALE);
}

/**
 * Messages for a locale, falling back to English key by key.
 *
 * Partial translation is the normal state of a translated site, not an error.
 * A missing French string shows the English one rather than a blank or a raw
 * key, so a half-finished translation degrades into a readable page.
 */
export async function loadMessages(code: string): Promise<Messages> {
  if (code === DEFAULT_LOCALE) return en as Messages;
  try {
    const mod = await LOADERS[code]?.();
    if (!mod) return en as Messages;
    return deepMerge(en as Record<string, unknown>, mod.default as Record<string, unknown>) as Messages;
  } catch {
    // No file yet for this locale. English is the right answer, not a crash.
    return en as Messages;
  }
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined && v !== '') {
      out[k] = v;
    }
  }
  return out;
}

/** Look up a dotted key: t(messages, 'nav.menu'). */
export function translate(messages: Messages, key: string): string {
  const found = key.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    messages,
  );
  return typeof found === 'string' ? found : key;
}

/** Convenience for server components: const t = await getT(). */
export async function getT() {
  const locale = await currentLocale();
  const messages = await loadMessages(locale.code);
  return Object.assign(
    (key: string) => translate(messages, key),
    { locale, messages },
  );
}
