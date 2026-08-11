'use client';

import { useEffect, useRef, useState } from 'react';
import { trackOnce } from '@/lib/track';

/* The Sanctum Journal signup.
 *
 * Above the footer on every public page, built once and included by the
 * layout rather than copied into each template.
 *
 * `source` says which page it came from, for attribution.
 *
 * Two-column: wordmark + tagline on the left, invitation + form on the right.
 * Cloudflare Turnstile renders only once NEXT_PUBLIC_TURNSTILE_SITE_KEY is set,
 * so the form still works before the key is configured. Marketing consent is an
 * express, unticked-by-default checkbox — the tick is the record.
 *
 * On success a confirmation modal overlays the page; the form stays put
 * underneath and resets when the modal is dismissed. */

const CONSENT_TEXT =
  'I agree to receive marketing emails from The Global Sanctum and understand I can unsubscribe at any time.';

export default function JournalSignup({ source }: { source: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle');
  const [problem, setProblem] = useState('');

  // Hidden by CSS rather than by type="hidden", so a script filling every
  // field trips it and a person never sees it.
  const [trap, setTrap] = useState('');

  // Cloudflare Turnstile. Rendered explicitly so it survives hydration.
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [token, setToken] = useState('');
  const tsRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!siteKey || !tsRef.current) return;
    let cancelled = false;

    const render = () => {
      const ts = (window as any).turnstile;
      if (cancelled || !ts || !tsRef.current || widgetId.current !== null) return;
      widgetId.current = ts.render(tsRef.current, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      });
    };

    if ((window as any).turnstile) {
      render();
    } else {
      const existing = document.querySelector('script[data-turnstile]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', render);
      } else {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.defer = true;
        s.setAttribute('data-turnstile', '');
        s.onload = render;
        document.head.appendChild(s);
      }
    }

    return () => { cancelled = true; };
  }, [siteKey]);

  const resetWidget = () => {
    const ts = (window as any).turnstile;
    if (ts && widgetId.current !== null) ts.reset(widgetId.current);
    setToken('');
  };

  const closeSuccess = () => {
    setState('idle');
    setEmail('');
    setName('');
    setConsented(false);
    setProblem('');
    resetWidget();
  };

  // Modal: lock background scroll, take focus, close on Escape.
  useEffect(() => {
    if (state !== 'done') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSuccess(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const submit = async () => {
    if (state === 'sending') return;
    if (!email.trim()) { setProblem('An email address, and that is all.'); return; }
    if (!consented) {
      setProblem('Please tick the box to confirm you are happy to receive the Journal.');
      return;
    }
    if (siteKey && !token) { setProblem('Please complete the verification below.'); return; }

    setState('sending');
    setProblem('');

    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email, name, source, website: trap,
          consent: consented, consentText: CONSENT_TEXT,
          turnstileToken: token,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error ?? 'That did not go through.');
      trackOnce('newsletter_signup', { source });
      setState('done');
    } catch (e: any) {
      setProblem(String(e?.message ?? e));
      setState('failed');
      resetWidget();
    }
  };

  return (
    <>
      <section className="journal">
        <div className="wrap journal-inner journal-split">
          <div className="journal-lede">
            <img className="journal-wordmark" src="/brand/sanctum-journal-wordmark.svg"
              alt="The Sanctum Journal" width={280} height={105} />
            <p className="journal-tagline">Words on Wellness. Places &amp; Practice. Quietly Curated.</p>
          </div>

          <div className="journal-body">
            <h2>Join The Community</h2>
            <p className="journal-sub">
              Featured venues, practitioner spotlights, wellness discoveries, and our global
              calendar of retreats. Curated for the Sanctum community, delivered monthly.
            </p>

            <div className="journal-form">
              {/* Not display:none — some scripts skip those. Positioned away
                  instead, which a person never sees and a bot fills. */}
              <div className="trap" aria-hidden="true">
                <label htmlFor={`site-${source}`}>Website</label>
                <input id={`site-${source}`} tabIndex={-1} autoComplete="off"
                  value={trap} onChange={(e) => setTrap(e.target.value)} />
              </div>

              <input
                type="text" placeholder="First name" aria-label="First name"
                value={name} onChange={(e) => setName(e.target.value)} />
              <input
                type="email" placeholder="Your email" aria-label="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()} />
              <button type="button" onClick={submit} disabled={state === 'sending'}>
                {state === 'sending' ? 'Just a moment' : 'Subscribe'}
              </button>
            </div>

            <label className="journal-consent">
              <input type="checkbox" checked={consented}
                onChange={(e) => setConsented(e.target.checked)} />
              <span>{CONSENT_TEXT}</span>
            </label>

            {siteKey && <div className="journal-turnstile" ref={tsRef} />}

            {problem && <p className="journal-problem">{problem}</p>}

            <p className="journal-fine">
              <a href="/legal#privacy">Read our privacy policy</a>
            </p>
          </div>
        </div>
      </section>

      {state === 'done' && (
        <div className="journal-modal" role="dialog" aria-modal="true"
          aria-labelledby="journal-modal-title" onClick={closeSuccess}>
          <div className="journal-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="journal-modal-close"
              aria-label="Close" onClick={closeSuccess}>&times;</button>
            <img className="journal-modal-mark" src="/brand/sanctum-journal-wordmark.svg"
              alt="The Sanctum Journal" width={200} height={75} />
            <h2 id="journal-modal-title">Thank you.</h2>
            <p>The next issue will arrive in your inbox.</p>
            <button type="button" className="journal-modal-done" onClick={closeSuccess}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
