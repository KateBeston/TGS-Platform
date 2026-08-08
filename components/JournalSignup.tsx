'use client';

import { useState } from 'react';
import { trackOnce } from '@/lib/track';

/* The Sanctum Journal signup.
 *
 * Above the footer on every public page, built once and included by the
 * layout rather than copied into each template. The handover is explicit
 * about this — per-template copies are how eleven pages end up with nine
 * versions of the same form.
 *
 * `source` says which page it came from, for attribution. */

export default function JournalSignup({ source }: { source: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle');
  const [problem, setProblem] = useState('');

  // Hidden by CSS rather than by type="hidden", so a script filling every
  // field trips it and a person never sees it. The audit found this one
  // visible on the live home page.
  const [trap, setTrap] = useState('');

  const submit = async () => {
    if (state === 'sending') return;
    if (!email.trim()) { setProblem('An email address, and that is all.'); return; }

    setState('sending');
    setProblem('');

    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name, source, website: trap }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error ?? 'That did not go through.');
      trackOnce('newsletter_signup', { source });
      setState('done');
    } catch (e: any) {
      setProblem(String(e?.message ?? e));
      setState('failed');
    }
  };

  if (state === 'done') {
    return (
      <section className="journal">
        <div className="wrap journal-inner">
          <div className="eyebrow">The Sanctum Journal</div>
          <h2>Thank you.</h2>
          <p className="journal-sub">
            The next issue will arrive in your inbox. One a month, and nothing else.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="journal">
      <div className="wrap journal-inner">
        <div className="eyebrow">The Sanctum Journal</div>
        <h2>A monthly letter, for those who travel to restore</h2>
        <p className="journal-sub">
          New sanctuaries, quietly considered. One a month, and nothing else.
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

        {problem && <p className="journal-problem">{problem}</p>}

        <p className="journal-fine">
          We write once a month and never share your address.
          {' '}<a href="/legal#privacy">How we handle your details</a>.
        </p>
      </div>
    </section>
  );
}
