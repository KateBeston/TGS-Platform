import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { AuthPagePanel } from '@/components/AuthForms';

export const metadata = { title: 'Sign in — The Global Sanctum' };

export default async function LoginPage() {
  if (await getUser()) redirect('/account');
  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">The Global Sanctum</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your account.</p>
        <AuthPagePanel initialMode="login" />
        <p className="auth-legal">
          By continuing you agree to our <Link href="/legal#terms-and-conditions">Terms</Link> and{' '}
          <Link href="/legal#privacy-policy">Privacy&nbsp;Policy</Link>.
        </p>
      </div>
    </main>
  );
}
