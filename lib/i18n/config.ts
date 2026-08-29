/* The languages the site speaks.
 *
 * English lives at the root and every other language takes a prefix:
 * /venues stays /venues, and French is /fr/venues. Six Senses put English at
 * /en/ and redirect the root, which is fine for them and would be costly here,
 * because the nested /continent/country/state/city structure is published and
 * permanent. Prefixing English would rewrite every URL on the site.
 *
 * `enabled` is the gate. A locale appears in the picker only once its messages
 * exist, because a picker that switches to French and then shows English is
 * worse than no picker at all. Turn one on when its translation lands.
 */

export type Locale = {
  code: string;          // ISO 639-1, used for <html lang> and hreflang
  label: string;         // what the picker shows, e.g. FR
  native: string;        // the language in its own language
  english: string;       // for internal screens
  dir: 'ltr' | 'rtl';
  enabled: boolean;
};

export const LOCALES: Locale[] = [
  { code: 'en', label: 'EN', native: 'English',    english: 'English',            dir: 'ltr', enabled: true },
  { code: 'fr', label: 'FR', native: 'Français',   english: 'French',             dir: 'ltr', enabled: false },
  { code: 'es', label: 'ES', native: 'Español',    english: 'Spanish',            dir: 'ltr', enabled: false },
  { code: 'it', label: 'IT', native: 'Italiano',   english: 'Italian',            dir: 'ltr', enabled: false },
  { code: 'pt', label: 'PT', native: 'Português',  english: 'Portuguese',         dir: 'ltr', enabled: false },
  { code: 'de', label: 'DE', native: 'Deutsch',    english: 'German',             dir: 'ltr', enabled: false },
  { code: 'ja', label: 'JA', native: '日本語',       english: 'Japanese',           dir: 'ltr', enabled: false },
  { code: 'zh', label: 'ZH', native: '中文',         english: 'Chinese',            dir: 'ltr', enabled: false },
  { code: 'ru', label: 'RU', native: 'Русский',    english: 'Russian',            dir: 'ltr', enabled: false },
  { code: 'tr', label: 'TR', native: 'Türkçe',     english: 'Turkish',            dir: 'ltr', enabled: false },
  { code: 'vi', label: 'VI', native: 'Tiếng Việt', english: 'Vietnamese',         dir: 'ltr', enabled: false },
  { code: 'ar', label: 'AR', native: 'العربية',     english: 'Arabic',             dir: 'rtl', enabled: false },
  { code: 'he', label: 'HE', native: 'עברית',       english: 'Hebrew',             dir: 'rtl', enabled: false },
];

export const DEFAULT_LOCALE = 'en';

/* Six Senses show JP, VN and ZH in their picker. Those are country codes
   rather than language codes; the correct ISO 639-1 values are ja, vi and zh,
   and using them matters because the same strings go into <html lang> and
   hreflang, where a wrong code is worse than no code. The picker can still
   display whatever label reads best. */

export const localeCodes = () => LOCALES.map((l) => l.code);
export const enabledLocales = () => LOCALES.filter((l) => l.enabled);
export const getLocale = (code: string | null | undefined): Locale =>
  LOCALES.find((l) => l.code === code) ?? LOCALES[0];
export const isRtl = (code: string) => getLocale(code).dir === 'rtl';

/** Rewrite a path into another locale, keeping English unprefixed. */
export function localisePath(path: string, code: string): string {
  const bare = stripLocale(path);
  if (code === DEFAULT_LOCALE) return bare || '/';
  return `/${code}${bare === '/' ? '' : bare}`;
}

/** The path with any locale prefix removed. */
export function stripLocale(path: string): string {
  const m = /^\/([a-z]{2})(\/|$)/.exec(path);
  if (m && localeCodes().includes(m[1]) && m[1] !== DEFAULT_LOCALE) {
    const rest = path.slice(m[1].length + 1);
    return rest || '/';
  }
  return path || '/';
}

/** The locale a path is asking for, or null if it carries no prefix. */
export function localeFromPath(path: string): string | null {
  const m = /^\/([a-z]{2})(\/|$)/.exec(path);
  if (!m) return null;
  const found = LOCALES.find((l) => l.code === m[1] && l.code !== DEFAULT_LOCALE);
  return found ? found.code : null;
}
