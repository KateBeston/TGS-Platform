'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { finishSignup } from '@/app/actions/finishSignup';

/* Setting the password on the far side of the confirmation link.
 *
 * The password typed on the sign-up form was deliberately not kept. It
 * is asked for again here, once the mailbox has been proven, because
 * this address may already protect live venue access and a password
 * that took effect before that proof would hand it to whoever typed the
 * address in. */
export default function FinishSignupForm() {
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
