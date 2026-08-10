'use client';

import Link from 'next/link';
import { Suspense, useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from '@/app/actions/auth';
import Turnstile from '@/components/Turnstile';

/** Statements rotate by day rather than at random, so the page does not
 *  flicker between renders and the server and client agree on what to show. */
const STATEMENTS = [
  { line: 'The monastery meets metrics.',        under: 'Where ancient wisdom meets modern systems.' },
  { line: 'Where reverence meets data.',         under: 'Building the infrastructure for human flourishing.' },
  { line: 'Fourteen divisions, one mission.',    under: 'Where individual transformation creates collective healing.' },
  { line: 'Infrastructure for human flourishing.', under: 'Retreat spaces, wellness experiences, globally curated.' },
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  const [token, setToken] = useState('');

  const day = Math.floor(Date.now() / 86_400_000);
  const s = STATEMENTS[day % STATEMENTS.length];

  return (
    <div className="auth">
      {/* ── brand panel ────────────────────────────────────────────────
          The photograph is optional. Drop a file at public/login.jpg and
          it appears behind the charcoal wash; without one the panel still
          reads correctly, just plainer. */}
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
            <p className="line">{s.line}</p>
            <p className="under">{s.under}</p>
          </blockquote>
        </div>

        <div className="auth-foot">Aurella Group Pty Ltd</div>
      </aside>

      {/* ── form ─────────────────────────────────────────────────────── */}
      <main className="auth-form">
        <form className="auth-card" action={action}>
          <div className="auth-eyebrow">The Global Sanctum</div>
          <h1>Internal portal</h1>

          <div className="f">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
          </div>

          <div className="f">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password"
                   autoComplete="current-password" required />
          </div>

          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onToken={(t) => setToken(t)} />
          <input type="hidden" name="cf-turnstile-response" value={token} />

          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>

          {state?.error && (
            <div className="note bad" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
              {state.error}
            </div>
          )}

          <div className="signin-foot">
            <Link href="/forgot" style={{ color: 'var(--ink-gold)' }}>Forgotten your password?</Link>
          </div>
        </form>
      </main>
    </div>
  );
}


/** Why somebody is back at the sign-in page.
 *
 *  Without this a timeout looks like a fault — the portal simply threw
 *  them out, and they assume something broke.
 */
function EndedNotice() {
  const params = useSearchParams();
  const reason = params.get('ended') ?? (params.get('recovered') ? 'recovered' : null);
  if (!reason) return null;

  return (
    <div className="note" style={{ marginBottom: 'var(--s4)' }}>
      {reason === 'recovered'
        ? 'Recovery code used and the authenticator removed. Sign in with your password, then set up a new one — and generate fresh recovery codes while you are there.'
        : reason === 'idle'
        ? 'Signed out after two hours with nothing happening. Everything you had saved is still there.'
        : 'Signed out after twelve hours. Sessions do not run longer than that, whatever is going on.'}
    </div>
  );
}
