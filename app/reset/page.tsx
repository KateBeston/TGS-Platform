import Link from 'next/link';
import { AuthPagePanel } from '@/components/AuthForms';

export const metadata = { title: 'Reset your password — The Global Sanctum' };

export default function ResetPage() {
  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">The Global Sanctum</div>
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-sub">We&rsquo;ll email you a link to set a new one.</p>
        <AuthPagePanel initialMode="reset" />
        <p className="auth-legal"><Link href="/login">Back to sign in</Link></p>
      </div>
    </main>
  );
}
