'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { enabledLocales, localisePath, stripLocale } from '@/lib/i18n/config';
import { useLocale, useT } from '@/lib/i18n/client';

/* The language picker.
 *
 * Only locales marked enabled in the config appear. That is the whole guard
 * against the failure this feature invites: a picker offering twelve languages
 * where eleven show English reads as broken, not as international. Turn one on
 * when its messages land.
 *
 * Switching keeps the visitor on the page they were reading, in the new
 * language, rather than returning them to the home page.
 */

/* The mark: a dot above a wide, shallow downward chevron.
 *
 * Drawn to the proportions in the reference — the chevron is about half as
 * deep as it is wide, the dot sits just clear of the tips, and both are a
 * single hairline weight. It reads as an arrow without being one, which is
 * what stops it looking like a form control. */
function Mark() {
  return (
    <svg className="lang-mark" viewBox="0 0 24 24" aria-hidden="true"
         fill="none" stroke="currentColor" strokeWidth="1.3"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7.9" r="0.85" fill="currentColor" stroke="none" />
      <path d="M5.6 10.7 12 16.2 18.4 10.7" />
    </svg>
  );
}

export default function LanguagePicker() {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  const options = enabledLocales();

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, []);

  // One language is not a choice. Hidden entirely until a second is turned on,
  // so nothing sits in the bar doing nothing.
  if (options.length < 2) return null;

  const choose = (code: string) => {
    setOpen(false);
    document.cookie = `tgs_locale=${code};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.push(localisePath(stripLocale(pathname), code));
    router.refresh();
  };

  return (
    <div className={`lang${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="lang-btn"
        aria-expanded={open} aria-haspopup="listbox"
        aria-label={t('nav.chooseLanguage')}
        onClick={() => setOpen((v) => !v)}>
        <Mark />
        <span className="lang-code">{locale.label}</span>
      </button>

      <div className="lang-menu" role="listbox" aria-label={t('nav.chooseLanguage')}>
        {options.map((l) => (
          <button key={l.code} type="button" role="option"
            aria-selected={l.code === locale.code}
            className={`lang-opt${l.code === locale.code ? ' on' : ''}`}
            lang={l.code} dir={l.dir}
            onClick={() => choose(l.code)}>
            <span className="lang-native">{l.native}</span>
            <span className="lang-abbr">{l.label}</span>
          </button>
        ))}
        <p className="lang-notice">{t('language.noticeShort')}</p>
      </div>
    </div>
  );
}
