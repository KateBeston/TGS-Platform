'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { finishSignup, finishSignupNoPassword } from '@/app/actions/finishSignup';

/* The last step of a sign-up, in whichever of its two shapes applies.
 *
 * `needsPassword` is decided on the server from the account itself, never
 * from anything the browser says. An account that already has a password
 * is not asked for one and does not have one written: see the note in
 * app/actions/finishSignup.ts for why that matters.
 */
export default function FinishSignupForm({ needsPassword }: { needsPassword: boolean }) {
  const [state, action, pending] = useActionState(finishSignup, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) { router.refresh(); router.push('/account'); }
  }, [state?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state?.ok) {
    return (
      <div className="auth-sent">
        <p>Your account is open. Taking you to it now.</p>
      </div>
    );
  }

  if (!needsPassword) return <OpenStraightAway />;

  return (
    <form action={action} className="auth-form">
      <label className="auth-field"><span>Password</span>
        <input type="password" name="password" autoComplete="new-password"
               minLength={8} required autoFocus />
        <small>At least 8 characters.</small></label>
      <label className="auth-field"><span>Confirm password</span>
        <input type="password" name="confirm_password" autoComplete="new-password"
               minLength={8} required /></label>
      {state?.error && <p className="auth-error">{state.error}</p>}
      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? 'Opening your account…' : 'Open my account'}
      </button>
    </form>
  );
}

/* Nothing left to ask. The account is opened on arrival and they are sent
 * to it — no button to press, because there is no decision to make.
 *
 * Run once: a server action in an effect will fire twice under React's
 * development double-render, and the second call would send a second
 * welcome email. */
function OpenStraightAway() {
  const [state, action, pending] = useActionState(finishSignupNoPassword, null);
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    action();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state?.ok) { router.refresh(); router.push('/account'); }
  }, [state?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state?.error) {
    return (
      <div className="auth-sent">
        <p className="auth-error">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="auth-sent">
      <p>{pending ? 'Opening your account…' : 'One moment.'}</p>
    </div>
  );
}
