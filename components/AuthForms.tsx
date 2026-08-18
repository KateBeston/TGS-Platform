'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, requestReset } from '@/app/actions/auth';
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
    router.refresh();
    if (onSuccess) onSuccess(); else router.push('/account');
  }, [ok]); // eslint-disable-line react-hooks/exhaustive-deps
}

function LoginView({ setMode, onSuccess }: { setMode: (m: Mode) => void; onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(signIn, null);
  useSuccess(state?.ok, onSuccess);
  return (
    <form action={action} className="auth-form">
      <label className="auth-field"><span>Email</span>
        <input type="email" name="email" autoComplete="email" required /></label>
      <label className="auth-field"><span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required /></label>
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
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
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
