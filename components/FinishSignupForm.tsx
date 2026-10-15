'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { finishSignup, finishSignupNoPassword } from '@/app/actions/finishSignup';

/* The last step of a sign-up, in whichever of its three shapes applies.
 *
 * The shape is decided on the server from the account itself, never from
 * anything the browser says. An account that already has a password is
 * not asked for one and does not have one written: see the note in
 * app/actions/finishSignup.ts for why that matters.
 *
 *   needsPassword              choose one, required
 *   reinstating                reopening a closed account; the password is
 *                              optional when there already is one, so they
 *                              may keep it or set a new one here
 *   neither                    opened on arrival, nothing to ask
 */
export default function FinishSignupForm({
  needsPassword, reinstating = false,
}: { needsPassword: boolean; reinstating?: boolean }) {
  const [state, action, pending] = useActionState(finishSignup, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) { router.refresh(); router.push('/account'); }
  }, [state?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state?.ok) {
    return (
      <div className="auth-sent">
        <p>{reinstating
          ? 'Your account is open again. Taking you to it now.'
          : 'Your account is open. Taking you to it now.'}</p>
      </div>
    );
  }

  /* Nothing to decide only when there is nothing to decide. Somebody
     reopening an account is shown the form even if a password exists,
     because choosing a new one is part of coming back. */
  if (!needsPassword && !reinstating) return <OpenStraightAway />;

  const optional = reinstating && !needsPassword;

  return (
    <form action={action} className="auth-form">
      <label className="auth-field">
        <span>{optional ? 'New password (optional)' : 'Password'}</span>
        <input type="password" name="password" autoComplete="new-password"
               minLength={8} required={!optional} autoFocus />
        <small>{optional
          ? 'Leave this blank to keep the password you had, or set a new one.'
          : 'At least 8 characters.'}</small></label>
      <label className="auth-field">
        <span>{optional ? 'Confirm new password' : 'Confirm password'}</span>
        <input type="password" name="confirm_password" autoComplete="new-password"
               minLength={8} required={!optional} /></label>
      {state?.error && <p className="auth-error">{state.error}</p>}
      <button type="submit" className="auth-submit" disabled={pending}>
        {pending
          ? (reinstating ? 'Reopening your account…' : 'Opening your account…')
          : (reinstating ? 'Reopen my account' : 'Open my account')}
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
