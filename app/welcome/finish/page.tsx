import Link from 'next/link';
import FinishSignupForm from '@/components/FinishSignupForm';

export const metadata = {
  title: 'Finish setting up your account — The Global Sanctum',
  robots: { index: false, follow: false },
};

/* The last step of a sign-up that began on the marketplace and was
 * confirmed by email.
 *
 * Reached only from the confirmation link, which is what proves the
 * mailbox. Nothing here says "sign in": as far as this person is
 * concerned they are signing up, and they are — the account they are
 * making did not exist an hour ago. What they already had was a way in
 * to different software. */
export default function FinishSignupPage() {
  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">The Global Sanctum</div>
        <h1 className="auth-title">One last step</h1>
        <p className="auth-sub">
          Your email is confirmed. Choose a password and your account is open.
        </p>
        <FinishSignupForm />
        <p className="auth-legal"><Link href="/">Back to the marketplace</Link></p>
      </div>
    </main>
  );
}
