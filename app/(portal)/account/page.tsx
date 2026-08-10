import { createClient } from '@/lib/supabase/server';
import AccountSecurity from '@/components/AccountSecurity';
import { myProfile } from '@/app/actions/profile';
import { myStatus } from '@/app/actions/security';
import MfaSetup from '@/components/MfaSetup';
import MyProfile from '@/components/MyProfile';
import RecoveryCodes from '@/components/RecoveryCodes';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const [security, profile] = await Promise.all([myStatus(), myProfile()]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from('app_users').select('*').eq('auth_user_id', user?.id ?? '').maybeSingle();

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>My account</h2>
          <div className="ph-sub">Sign-in details for {user?.email}</div>
        </div>
      </div>

      <div className="note">
        <strong>Two records, one person.</strong> Supabase Auth holds the login — email and
        password.</div>

      <AccountSecurity email={user?.email ?? ''} lastSignIn={user?.last_sign_in_at ?? null} />

      <MyProfile profile={profile} />

      <MfaSetup />
      <RecoveryCodes status={security} />

      {!me && (
        <div className="note bad" style={{ marginTop: 'var(--s6)' }}>
          Your login is not yet linked to a portal account. Open People to link it.
        </div>
      )}
    </div></div>
  );
}
