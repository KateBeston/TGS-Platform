import { NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/** Spends a recovery code and removes the authenticator.
 *
 *  Supabase's second factor cannot be waived from the browser, so the
 *  code does the only thing that helps: it unenrols the factor, which
 *  returns the account to password-only sign-in. A new authenticator is
 *  then set up on whatever device replaced the lost one.
 *
 *  A route rather than an action because it needs the service role key,
 *  which must never reach the browser.
 */
export async function POST(request: Request) {
  const { email, code } = await request.json().catch(() => ({}));

  if (!email || !code) {
    return NextResponse.json({ ok: false, error: 'Address and code needed.' },
                             { status: 400 });
  }

  const supabase = await createClient();

  // Checked first. If the code is wrong, nothing else happens and the
  // attempt is recorded.
  const { data, error } = await supabase.rpc('redeem_recovery_code', {
    p_email: email, p_code: code,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = data as { ok: boolean; message: string; codes_left?: number };
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !url) {
    // The code is spent either way — it was checked and recorded. Saying
    // so plainly beats a generic failure, because the next step is a
    // configuration change rather than trying again.
    return NextResponse.json({
      ok: false,
      error: 'The code was accepted but the authenticator could not be removed — '
        + 'SUPABASE_SERVICE_ROLE_KEY is not set in the environment.',
    }, { status: 500 });
  }

  const admin = createAdmin(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: users } = await admin.auth.admin.listUsers();
  const user = users?.users.find(
    (u) => u.email?.toLowerCase() === String(email).toLowerCase());

  if (!user) {
    // Deliberately the same message as a wrong code. Distinguishing them
    // tells somebody which addresses exist.
    return NextResponse.json({ ok: false, error: 'That code was not accepted.' },
                             { status: 401 });
  }

  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  for (const f of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
  }

  await supabase.from('app_users')
    .update({ mfa_enrolled_at: null }).eq('auth_user_id', user.id);

  const left = result.codes_left ?? 0;
  return NextResponse.json({
    ok: true,
    codesLeft: left,
    message: 'Authenticator removed. Sign in with your password, then set up a new one — '
      + `${left} recovery code${left === 1 ? '' : 's'} left.`,
  });
}
