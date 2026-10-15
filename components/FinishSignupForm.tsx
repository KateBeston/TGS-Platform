'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
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
 *   reinstating                reopening a closed account that already has
 *                              a password — keep it, or replace it
 *   neither                    opened on arrival, nothing to ask
 */
export default function FinishSignupForm({
  needsPassword, reinstating = false, dormant = false,
}: { needsPassword: boolean; reinstating?: boolean; dormant?: boolean }) {
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
     because what happens to that password is a decision. */
  if (!needsPassword && !reinstating) return <OpenStraightAway />;

  if (reinstating && !needsPassword) {
    return <ReturningPassword action={action} pending={pending}
      error={state?.error ?? null} dormant={dormant} />;
  }

  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="password_choice" value="new" />
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

/* KEEPING A PASSWORD IS A CHOICE, NOT AN EMPTY FIELD.
 *
 * This used to be one optional field whose help text said that leaving it
 * blank kept the old password. Nobody reads a blank field as a decision.
 * Somebody who could not remember their password skipped it, was told
 * their account was open, and found out at the next sign-in that they
 * were locked out — a usability failure before it is a security one.
 *
 * So it is two choices, both visible. Choosing to keep is a claim that
 * they remember it.
 *
 * Neither is forced. They reached this page by clicking a link sent to
 * their mailbox, which is the same proof a password reset rests on, so
 * compelling a change here adds friction without adding a factor — and
 * does it at the moment somebody is coming back, which is the worst
 * moment to ask for admin.
 *
 * What is said instead is the one fact that lets them decide for
 * themselves: the password is the one they had before they closed the
 * account. Somebody who reused it somewhere that has since been breached
 * knows what to do with that, and no generic security nag would have told
 * them.
 */
function ReturningPassword({
  action, pending, error, dormant,
}: {
  action: (fd: FormData) => void; pending: boolean;
  error: string | null; dormant: boolean;
}) {
  /* Pre-selected by how long it has been. A year-old password is worth
     replacing; last month's is not, and nagging about the second teaches
     people to ignore the nag about the first. */
  const [choice, setChoice] = useState<'keep' | 'new'>(dormant ? 'new' : 'keep');

  return (
    <form action={action} className="auth-form">
      <p className="auth-pw-note">
        Your password is the same one you had before you closed your account. It is the
        password for this email address wherever you sign in with it.
      </p>

      <div className="auth-choice">
        <label className={`auth-choice-opt${choice === 'keep' ? ' on' : ''}`}>
          <input type="radio" name="password_choice" value="keep"
            checked={choice === 'keep'} onChange={() => setChoice('keep')} />
          <span>
            <strong>Keep my current password</strong>
            <small>Use the one you had before. Choose this only if you remember it.</small>
          </span>
        </label>
        <label className={`auth-choice-opt${choice === 'new' ? ' on' : ''}`}>
          <input type="radio" name="password_choice" value="new"
            checked={choice === 'new'} onChange={() => setChoice('new')} />
          <span>
            <strong>Set a new password</strong>
            <small>{dormant
              ? 'Recommended — it has been a while, so the old one is likely stale.'
              : 'Recommended if you are not sure you remember the old one.'}</small>
          </span>
        </label>
      </div>

      {choice === 'new' && (
        <>
          <label className="auth-field"><span>New password</span>
            <input type="password" name="password" autoComplete="new-password"
                   minLength={8} required autoFocus />
            <small>At least 8 characters.</small></label>
          <label className="auth-field"><span>Confirm new password</span>
            <input type="password" name="confirm_password" autoComplete="new-password"
                   minLength={8} required /></label>
        </>
      )}

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? 'Reopening your account…' : 'Reopen my account'}
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
