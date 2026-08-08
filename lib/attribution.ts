'use client';

/* First touch, kept once.
 *
 * Somebody who found us through the Journal in March and enquired via a
 * Google search in August was brought here by the Journal. Overwriting
 * on the second visit credits the wrong thing, so this writes only if
 * nothing is stored.
 *
 * sessionStorage rather than a cookie, because it needs no banner and
 * the value is not tracking anybody across sites — it is a note about
 * how they arrived at this one. */

const KEY = 'tgs.first-touch';

export type FirstTouch = {
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_term?: string; utm_content?: string;
  click_id?: string; referrer?: string; landing_page?: string;
  first_touch_at?: string;
};

export function captureFirstTouch(): void {
  if (typeof window === 'undefined') return;
  try {
    // Written once. A second visit does not overwrite a first.
    if (sessionStorage.getItem(KEY)) return;

    const q = new URLSearchParams(window.location.search);
    const get = (k: string) => q.get(k) || undefined;

    const touch: FirstTouch = {
      utm_source: get('utm_source'),
      utm_medium: get('utm_medium'),
      utm_campaign: get('utm_campaign'),
      utm_term: get('utm_term'),
      utm_content: get('utm_content'),
      click_id: get('gclid') || get('fbclid') || get('msclkid') || undefined,
      // Our own pages are not a referrer worth recording.
      referrer: document.referrer && !document.referrer.includes(window.location.host)
        ? document.referrer : undefined,
      landing_page: window.location.pathname,
      first_touch_at: new Date().toISOString(),
    };

    sessionStorage.setItem(KEY, JSON.stringify(touch));
  } catch {
    // Private browsing refuses sessionStorage. Attribution is worth
    // having and not worth breaking a form over.
  }
}

export function firstTouch(): FirstTouch {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
