'use client';

/* Cookie consent, and what it actually controls.
 *
 * The audit asks for genuine accept and reject with rejection as easy as
 * acceptance, wired to Consent Mode v2 so tags respect the choice. That
 * last part is what makes a banner honest rather than decorative — a
 * banner that records a preference nothing reads is worse than none,
 * because it tells somebody they have a choice they do not have.
 *
 * Four categories, but only two decisions. Essential is not offered
 * because it cannot be declined and pretending otherwise is a lie;
 * functional, analytics and marketing are the real question.
 */

export const CONSENT_KEY = 'tgs.consent';
export const CONSENT_VERSION = 1;

export type Consent = {
  version: number;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export const ALL_YES: Omit<Consent, 'version' | 'decidedAt'> = {
  functional: true, analytics: true, marketing: true,
};

export const ALL_NO: Omit<Consent, 'version' | 'decidedAt'> = {
  functional: false, analytics: false, marketing: false,
};

export function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Consent;
    // A stored choice from an older version is asked again rather than
    // assumed forward. If the categories change, the old answer was to a
    // different question.
    if (c.version !== CONSENT_VERSION) return null;
    return c;
  } catch {
    return null;
  }
}

export function writeConsent(choice: Omit<Consent, 'version' | 'decidedAt'>) {
  const c: Consent = {
    ...choice, version: CONSENT_VERSION, decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(c));
  } catch {
    // Private browsing. The choice holds for the page; the banner
    // reappears next visit, which is the safe direction to fail.
  }
  applyConsent(c);
  return c;
}

/* Tells Google what was decided.
 *
 * Consent Mode v2. Denied is the default, set before any tag loads —
 * so a visitor who never answers is treated as having declined, which
 * is the only defensible default. */
export function applyConsent(c: Omit<Consent, 'version' | 'decidedAt'>) {
  if (typeof window === 'undefined') return;
  const w = window as any;
  w.dataLayer = w.dataLayer ?? [];
  function gtag(...args: any[]) { w.dataLayer.push(args); }

  gtag('consent', 'update', {
    ad_storage: c.marketing ? 'granted' : 'denied',
    ad_user_data: c.marketing ? 'granted' : 'denied',
    ad_personalization: c.marketing ? 'granted' : 'denied',
    analytics_storage: c.analytics ? 'granted' : 'denied',
    functionality_storage: c.functional ? 'granted' : 'denied',
    personalization_storage: c.functional ? 'granted' : 'denied',
    // Never denied. It covers fraud prevention and it is not a
    // preference anybody is being asked about.
    security_storage: 'granted',
  });

  w.dataLayer.push({ event: 'consent_decided' });
}
