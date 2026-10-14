'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, requestReset } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/client';
import Turnstile from '@/components/Turnstile';

type Mode = 'login' | 'signup' | 'reset';

/* One panel for all three auth views, used inside the modal and on the
 * fallback pages. On success it refreshes in place (so the header and any
 * pending action update) and calls onSuccess — which the modal uses to
 * close. On a page with no onSuccess, it sends them to their account. */

export function AuthPanel({
  mode, setMode, onSuccess, showBenefits = true,
}: {
  mode: Mode; setMode: (m: Mode) => void; onSuccess?: () => void;
  /* The wide modal shows the reasons in its own left-hand pane, so the
     form must not repeat them. The standalone /signup page has no second
     pane and keeps them. */
  showBenefits?: boolean;
}) {
  /* Carried from sign-up to sign-in when the address turns out to be
     known: the address itself, so it does not have to be typed twice,
     and which of the two situations it is, because they read nothing
     alike to the person in front of them. */
  const [handoff, setHandoff] = useState<{ email: string; kind: 'platform' | 'vms' } | null>(null);

  if (mode === 'signup') {
    return (
      <SignupView setMode={setMode} onSuccess={onSuccess} showBenefits={showBenefits}
        onKnownAddress={(email, kind) => { setHandoff({ email, kind }); setMode('login'); }} />
    );
  }
  if (mode === 'reset') {
    return <ResetView setMode={setMode} prefillEmail={handoff?.email ?? null} />;
  }
  return (
    <LoginView setMode={setMode} onSuccess={onSuccess} prefillEmail={handoff?.email ?? null}
      notice={!handoff ? null : handoff.kind === 'vms'
        /* Never "you already have an account" — they do not, and being
           told they do is how somebody decides the site is broken.
           What is shared is the sign-in, not the account. */
        ? `You already sign in to Sanctum VMS with ${handoff.email}, and one sign-in covers everything at The Global Sanctum. Sign in with it once and your guest account is set up straight away, with the choices you just made. Forgotten the password? Reset it below.`
        : `${handoff.email} is already registered. Sign in below, or reset your password if you have forgotten it.`} />
  );
}

function useSuccess(ok: boolean | undefined, onSuccess?: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (!ok) return;
    // In the modal, the header, drawer and favourites all update instantly from
    // the client-side auth state — no server refresh needed. Calling
    // router.refresh() here re-fetches the whole (heavy) page and makes sign-in
    // feel frozen for many seconds, so only refresh on the standalone pages.
    if (onSuccess) { onSuccess(); return; }
    router.refresh();
    router.push('/account');
  }, [ok]); // eslint-disable-line react-hooks/exhaustive-deps
}

function LoginView({
  setMode, onSuccess, prefillEmail = null, notice = null,
}: {
  setMode: (m: Mode) => void; onSuccess?: () => void;
  prefillEmail?: string | null; notice?: string | null;
}) {
  const [state, action, pending] = useActionState(signIn, null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const router = useRouter();
  useSuccess(state?.ok, onSuccess);

  const completeMfa = async () => {
    setMfaError(''); setMfaBusy(true);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === 'verified');
    if (!factor) { setMfaBusy(false); setMfaError('No authenticator is set up on this account.'); return; }
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (chErr || !ch) { setMfaBusy(false); setMfaError('Could not verify — please try again.'); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code: mfaCode.trim() });
    setMfaBusy(false);
    if (vErr) { setMfaError('That code didn\u2019t match — enter the current 6-digit code from your app.'); return; }
    if (onSuccess) onSuccess();
    router.refresh(); router.push('/account');
  };

  if (state?.needsMfa) {
    return (
      <div className="auth-form">
        <p className="auth-mfa-lead">Enter the 6-digit code from your authenticator app to finish signing in.</p>
        <label className="auth-field"><span>Authentication code</span>
          <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} inputMode="numeric" maxLength={6} autoFocus placeholder="123456" /></label>
        {mfaError && <p className="auth-error">{mfaError}</p>}
        <button type="button" className="auth-submit" onClick={completeMfa} disabled={mfaBusy || mfaCode.trim().length < 6}>
          {mfaBusy ? 'Verifying…' : 'Verify & sign in'}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="auth-form">
      {notice && <p className="auth-notice">{notice}</p>}
      <label className="auth-field"><span>Email</span>
        <input type="email" name="email" autoComplete="email" required
          defaultValue={prefillEmail ?? undefined}
          /* Straight to the password when the address came across with
             them, because the address is the part they have settled. */
          autoFocus={!prefillEmail ? undefined : false} /></label>
      <label className="auth-field"><span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required
          autoFocus={prefillEmail ? true : undefined} /></label>
      <label className="auth-remember">
        <input type="checkbox" name="remember" defaultChecked />
        <span>Keep me signed in</span>
      </label>
      {state?.error && <p className="auth-error">{state.error}</p>}
      <button type="submit" className="auth-submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      <div className="auth-links">
        <button type="button" className="auth-textlink" onClick={() => setMode('reset')}>Forgot your password?</button>
        <button type="button" className="auth-textlink" onClick={() => setMode('signup')}>Create an account</button>
      </div>
    </form>
  );
}

function SignupView({
  setMode, onSuccess, showBenefits = true, onKnownAddress,
}: {
  setMode: (m: Mode) => void; onSuccess?: () => void; showBenefits?: boolean;
  onKnownAddress?: (email: string, kind: 'platform' | 'vms') => void;
}) {
  const [state, action, pending] = useActionState(signUp, null);
  const [token, setToken] = useState('');
  useSuccess(state?.ok, onSuccess);

  /* A known address is not an error to read, it is a wrong turn to be
     walked back from. Hand them to sign-in with the address already in
     it rather than printing a sentence and leaving them to act on it. */
  useEffect(() => {
    if (state?.exists && state.email && onKnownAddress) {
      onKnownAddress(state.email, state.kind ?? 'platform');
    }
  }, [state?.exists, state?.email, state?.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state?.sent) {
    /* Unambiguous again. This used to have to hedge, because Supabase
       answers a repeat sign-up with the same empty success as a real one
       and somebody who already had an account would wait for a link that
       was never sent. The server now checks first and sends them to
       sign-in, so anything reaching this point really is new and the
       email really is on its way. */
    return (
      <div className="auth-sent">
        <p>Your confirmation link is on its way. Check your inbox, and your spam
          folder if it is not there.</p>
        <button type="button" className="auth-textlink" onClick={() => setMode('login')}>Back to sign in</button>
      </div>
    );
  }
  return (
    <form action={action} className="auth-form">
      <div className="trap" aria-hidden="true">
        <input type="text" name="hp_field" tabIndex={-1} autoComplete="off"
          data-1p-ignore="true" data-lpignore="true" data-form-type="other" />
      </div>
      {showBenefits && (
        <ul className="auth-benefits">
          <li>Save venues to your own collection</li>
          <li>Keep your bookings, quotes and enquiries in one place</li>
          <li>Early access to new venues and member offers</li>
        </ul>
      )}
      <div className="auth-row">
        <label className="auth-field"><span>First name</span>
          <input type="text" name="first_name" autoComplete="given-name" /></label>
        <label className="auth-field"><span>Surname</span>
          <input type="text" name="surname" autoComplete="family-name" /></label>
      </div>
      <label className="auth-field"><span>Email</span>
        <input type="email" name="email" autoComplete="email" required /></label>
      {/* Paired, like the names above. Two stacked password boxes were
          two of the eight rows that made this form taller than a laptop
          screen, and they are the same question asked twice. */}
      <div className="auth-row">
        <label className="auth-field"><span>Password</span>
          <input type="password" name="password" autoComplete="new-password" minLength={8} required />
          <small>At least 8 characters.</small></label>
        <label className="auth-field"><span>Confirm password</span>
          <input type="password" name="confirm_password" autoComplete="new-password" minLength={8} required /></label>
      </div>
      <label className="auth-field"><span>I&rsquo;m here mainly as a</span>
        <select name="primary_audience" defaultValue="guest">
          <option value="guest">Wellness guest</option>
          <option value="host">Retreat host</option>
          <option value="owner">Venue owner</option>
        </select></label>
      <label className="auth-check">
        <input type="checkbox" name="marketing_opt_in" />
        <span>Send me the Sanctum Journal, new venues and occasional offers.</span>
      </label>
      <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onToken={setToken} />
      <input type="hidden" name="cf-turnstile-response" value={token} />
      {state?.error && <p className="auth-error">{state.error}</p>}
      <button type="submit" className="auth-submit" disabled={pending}>{pending ? 'Creating your account…' : 'Create account'}</button>
      <div className="auth-links">
        <button type="button" className="auth-textlink" onClick={() => setMode('login')}>Already have an account? Sign in</button>
      </div>
    </form>
  );
}

function ResetView({
  setMode, prefillEmail = null,
}: { setMode: (m: Mode) => void; prefillEmail?: string | null }) {
  const [state, action, pending] = useActionState(requestReset, null);
  if (state?.sent) {
    return (
      <div className="auth-sent">
        <p>If that email is registered, we&rsquo;ve sent a link to reset your password.</p>
        <button type="button" className="auth-textlink" onClick={() => setMode('login')}>Back to sign in</button>
      </div>
    );
  }
  return (
    <form action={action} className="auth-form">
      <label className="auth-field"><span>Email</span>
        <input type="email" name="email" autoComplete="email" required
          defaultValue={prefillEmail ?? undefined} /></label>
      {state?.error && <p className="auth-error">{state.error}</p>}
      <button type="submit" className="auth-submit" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button>
      <div className="auth-links">
        <button type="button" className="auth-textlink" onClick={() => setMode('login')}>Back to sign in</button>
      </div>
    </form>
  );
}

/* Wrapper for the standalone fallback pages, holding its own mode. */
export function AuthPagePanel({ initialMode = 'login' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  return <AuthPanel mode={mode} setMode={setMode} />;
}
