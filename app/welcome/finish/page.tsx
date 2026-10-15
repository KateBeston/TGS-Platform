import { redirect } from 'next/navigation';
import FinishSignupForm from '@/components/FinishSignupForm';
import { signupShape, leaveWithoutFinishing } from '@/app/actions/finishSignup';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Finish setting up your account — The Global Sanctum',
  robots: { index: false, follow: false },
};

/* The last step of a sign-up that began on the marketplace and was
 * confirmed by email.
 *
 * Reached only from the confirmation link, which is what proves the
 * mailbox. Nothing here says "sign in": as far as this person is
 * concerned they are signing up, and they are — the marketplace account
 * they are making did not exist an hour ago.
 *
 * Unless they have been here before and closed it, in which case this is
 * where they are offered the same account back. Which of the three shapes
 * applies is answered on the server, from the account and the archive
 * rather than from the link or a cookie.
 */
export default async function FinishSignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  /* No session means the link was never followed, or has lapsed. Nothing
     on this page works without one. */
  if (!user) redirect('/login?error=link');

  const shape = await signupShape();
  const { needsPassword: needs, reinstating } = shape;

  const closed = shape.closedAt
    ? new Date(shape.closedAt).toLocaleDateString('en-AU',
        { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const title = reinstating
    ? (shape.firstName ? `Welcome back, ${shape.firstName}` : 'Welcome back')
    : needs ? 'One last step' : 'You’re all set';

  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">The Global Sanctum</div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">
          {reinstating
            ? <>This address belonged to an account you closed{closed ? ` on ${closed}` : ''}.
                Reopen it and your bookings, enquiries and history come back with it
                {needs ? ', once you choose a password' : ''}.</>
            : needs
              ? 'Your email is confirmed. Choose a password and your account is open.'
              : 'Your email is confirmed and your account is open.'}
        </p>
        <FinishSignupForm needsPassword={needs} reinstating={reinstating}
          dormant={shape.dormant} />

        {/* Not a link.
         *
         * Following the confirmation link signed them in, so a plain link
         * back to the marketplace handed somebody a signed-in session for
         * an account that had not been opened — no password set, and no
         * decision made about the one they already had. This signs them
         * out on the way, and the proxy does the same for the header mark,
         * the back button and the address bar. */}
        <form action={leaveWithoutFinishing} className="auth-legal">
          <button type="submit" className="auth-textlink">
            Not now — back to the marketplace
          </button>
        </form>
        <p className="auth-legal-note">
          You will be signed out. Your account is untouched, and signing up again
          sends a fresh link.
        </p>
      </div>
    </main>
  );
}
