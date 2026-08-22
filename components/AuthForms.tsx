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
  mode, setMode, onSuccess,
}: { mode: Mode; setMode: (m: Mode) => void; onSuccess?: () => void }) {
  if (mode === 'signup') return <SignupView setMode={setMode} onSuccess={onSuccess} />;
  if (mode === 'reset') return <ResetView setMode={setMode} />;
  return <LoginView setMode={setMode} onSuccess={onSuccess} />;
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

function LoginView({ setMode, onSuccess }: { setMode: (m: Mode) => void; onSuccess?: () => void }) {
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
      <label className="auth-field"><span>Email</span>
        <input type="email" name="email" autoComplete="email" required /></label>
      <label className="auth-field"><span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required /></label>
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

function SignupView({ setMode, onSuccess }: { setMode: (m: Mode) => void; onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(signUp, null);
  const [token, setToken] = useState('');
  useSuccess(state?.ok, onSuccess);
  if (state?.sent) {
    return (
      <div className="auth-sent">
        <p>Check your email to confirm your account, then sign in.</p>
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
      <ul className="auth-benefits">
        <li>Save venues to your own collection</li>
        <li>Keep your bookings, quotes and enquiries in one place</li>
        <li>Early access to new venues and member offers</li>
      </ul>
      <div className="auth-row">
        <label className="auth-field"><span>First name</span>
          <input type="text" name="first_name" autoComplete="given-name" /></label>
        <label className="auth-field"><span>Surname</span>
          <input type="text" name="surname" autoComplete="family-name" /></label>
      </div>
      <label className="auth-field"><span>Email</span>
        <input type="email" name="email" autoComplete="email" required /></label>
      <label className="auth-field"><span>Password</span>
        <input type="password" name="password" autoComplete="new-password" minLength={8} required />
        <small>At least 8 characters.</small></label>
      <label className="auth-field"><span>Confirm password</span>
        <input type="password" name="confirm_password" autoComplete="new-password" minLength={8} required /></label>
      <label className="auth-field"><span>I&rsquo;m here mainly as a</span>
        <select name="primary_audience" defaultValue="guest">
          <option value="guest">Wellness guest</option>
          <option value="host">Retreat host</option>
          <option value="owner">Venue owner</option>
        </select></label>
      <label className="auth-check">
        <input type="checkbox" name="marketing_opt_in" />
        <span>Send me the Sanctum Journal and occasional wellness discoveries.</span>
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

function ResetView({ setMode }: { setMode: (m: Mode) => void }) {
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
        <input type="email" name="email" autoComplete="email" required /></label>
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
