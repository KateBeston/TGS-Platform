import Link from 'next/link';
import { redirect } from 'next/navigation';
import FinishSignupForm from '@/components/FinishSignupForm';
import { needsPassword } from '@/app/actions/finishSignup';
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
 * Whether a password is asked for depends on the account, not on how it
 * got here, and the question is answered on the server.
 */
export default async function FinishSignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  /* No session means the link was never followed, or has lapsed. Nothing
     on this page works without one. */
  if (!user) redirect('/login?error=link');

  const needs = await needsPassword();

  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">The Global Sanctum</div>
        <h1 className="auth-title">{needs ? 'One last step' : 'You’re all set'}</h1>
        <p className="auth-sub">
          {needs
            ? 'Your email is confirmed. Choose a password and your account is open.'
            : 'Your email is confirmed and your account is open.'}
        </p>
        <FinishSignupForm needsPassword={needs} />
        <p className="auth-legal"><Link href="/">Back to the marketplace</Link></p>
      </div>
    </main>
  );
}
