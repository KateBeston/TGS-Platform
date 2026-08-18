import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { signOut } from '@/app/actions/auth';

export const metadata = { title: 'Your account — The Global Sanctum' };

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  const name = [profile.first_name, profile.surname].filter(Boolean).join(' ') || profile.email;
  return (
    <main id="main" className="auth-page">
      <div className="auth-card account-card">
        <div className="auth-eyebrow">Your account</div>
        <h1 className="auth-title">{name}</h1>
        <p className="auth-sub">{profile.email}</p>
        <p className="account-note">
          Saved venues, your bookings and profile settings are on their way as we build out
          your account area.
        </p>
        <form action={signOut}>
          <button type="submit" className="auth-submit ghost">Sign out</button>
        </form>
      </div>
    </main>
  );
}
