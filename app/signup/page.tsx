import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { AuthPagePanel } from '@/components/AuthForms';

export const metadata = { title: 'Create an account — The Global Sanctum' };

export default async function SignupPage() {
  if (await getUser()) redirect('/account');
  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">The Global Sanctum</div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Save venues, keep your bookings and build your profile.</p>
        <AuthPagePanel initialMode="signup" />
        <p className="auth-legal">
          By creating an account you agree to our <Link href="/legal#terms-and-conditions">Terms</Link> and{' '}
          <Link href="/legal#privacy-policy">Privacy&nbsp;Policy</Link>.
        </p>
      </div>
    </main>
  );
}
