'use client';

import Link from 'next/link';
import { useState } from 'react';
import Turnstile from '@/components/Turnstile';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function send() {
    // Created here rather than at render: this page is pre-rendered at build
    // time, when the browser env vars are not present.
    const supabase = createClient();
    setBusy(true); setMsg('');
    // Verified before Supabase is asked to send anything. Without it the
    // endpoint is a way to fill an inbox.
    const check = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then((r) => r.json()).catch(() => ({ ok: true }));

    if (!check.ok) { setBusy(false); return setMsg(check.reason); }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      // The current origin, so a reset requested from a preview
      // deployment returns to that preview rather than to production.
      // Every origin used must be listed in Supabase's redirect URLs, or
      // it silently falls back to the Site URL — which is how a link ends
      // up pointing at localhost.
      redirectTo: `${window.location.origin}/reset`,
    });
    setBusy(false);
    // Deliberately the same message either way — confirming whether an
    // address has an account tells an attacker who works here.
    setMsg(error && !/rate/i.test(error.message)
      ? 'If that address has an account, a reset link is on its way.'
      : error
        ? error.message
        : 'If that address has an account, a reset link is on its way.');
  }

  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <img
            src="/brand/tgs-logo-gold.png"
            alt="The Global Sanctum"
            className="auth-mark"
          />
          <div className="auth-tagline">
            <div className="t1">Retreat Spaces</div>
            <div className="t2">Wellness Experiences</div>
            <div className="t3">Globally Curated</div>
          </div>
          <div className="auth-rule" />
          <blockquote className="auth-statement">
            <p className="line">Where reverence meets data.</p>
            <p className="under">Building the infrastructure for human flourishing.</p>
          </blockquote>
        </div>
        <div className="auth-foot">Aurella Group Pty Ltd</div>
      </aside>

      <main className="auth-form">
      <div className="auth-card">
        <div className="auth-eyebrow">The Global Sanctum</div>
        <h1>Reset password</h1>

        <div className="f">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onToken={setToken} />

          <button className="btn" disabled={busy || !email.trim()} onClick={send}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>

        {msg && <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>{msg}</div>}

        <div className="signin-foot">
          <Link href="/login" style={{ color: 'var(--ink-gold)' }}>Back to sign in</Link>
        </div>
      </div>
      </main>
    </div>
  );
}
