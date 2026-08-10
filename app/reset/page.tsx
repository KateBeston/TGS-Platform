'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { checkPassword } from '@/lib/passwordCheck';
import { createClient } from '@/lib/supabase/client';

/** Landing page for the emailed recovery link.
 *
 *  Supabase's PKCE flow puts a one-time code in the query string, and it
 *  has to be exchanged for a session before anything can be changed.
 *  Older versions put a token in the URL fragment and the client picked
 *  it up on its own — this one does not, which is why a perfectly good
 *  link reads as expired if nothing exchanges it.
 */
export default function ResetPage() {
  return (
    <Suspense fallback={<div className="auth"><main className="auth-form">
      <div className="auth-card">
        <div className="auth-eyebrow">The Global Sanctum</div>
        <h1>Set a new password</h1>
        <div className="note" style={{ marginBottom: 0 }}>Checking the link…</div>
      </div>
    </main></div>}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const code = params.get('code');

    (async () => {
      // A session may already exist where the link was opened twice, or
      // where an older-style token in the fragment was picked up.
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) { setReady(true); setChecking(false); return; }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setReady(true);
          // The code is single use. Left in the address bar it invites a
          // refresh that fails, and reads as the link being broken.
          window.history.replaceState({}, '', '/reset');
        }
      }
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_e, session) => { if (session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, [params]);

  async function save() {
    const supabase = createClient();
    setMsg(null);
    if (pw.length < 12) {
      return setMsg({ ok: false, text: 'Use at least twelve characters.' });
    }

    // Checked against known breaches before it is accepted. The password
    // never leaves the browser — only the first five characters of its
    // hash are sent, and around 500 come back to compare here.
    setMsg({ ok: true, text: 'Checking…' });
    const verdict = await checkPassword(pw);
    if (!verdict.ok) {
      return setMsg({ ok: false, text: verdict.reason ?? 'Choose a different password.' });
    }
    if (pw !== pw2) return setMsg({ ok: false, text: 'The two entries do not match.' });

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: 'Password set. Taking you to the portal…' });
    // Recorded like any other sign-in, so a password change shows in the
    // access history rather than appearing as a session from nowhere.
    void fetch('/api/access/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'Password changed' }),
    }).catch(() => {});
    setTimeout(() => router.push('/home'), 1200);
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
        <h1>Set a new password</h1>

        {checking ? (
          <div className="note" style={{ marginBottom: 0 }}>Checking the link…</div>
        ) : !ready ? (
          <div className="note bad" style={{ marginBottom: 0 }}>
            This link is invalid or has expired. Reset links are single use and time limited —
            request a new one from the sign-in page.</div>
        ) : (
          <>
            <div className="f">
              <label htmlFor="p1">New password</label>
              <input id="p1" type="password" autoComplete="new-password"
                     value={pw} onChange={(e) => setPw(e.target.value)} />
              <span className="help">
                At least twelve characters. Length matters more than punctuation — a long
                phrase beats a short one with symbols in it.
              </span>
            </div>
            <div className="f">
              <label htmlFor="p2">Confirm password</label>
              <input id="p2" type="password" autoComplete="new-password"
                     value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <button className="btn" disabled={busy || !pw} onClick={save}>
              {busy ? 'Saving…' : 'Set password'}
            </button>
          </>
        )}

        {msg && <div className={`note ${msg.ok ? '' : 'bad'}`}
                     style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>{msg.text}</div>}
      </div>
      </main>
    </div>
  );
}
