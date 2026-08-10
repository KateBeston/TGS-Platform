'use server';

import { createClient } from '@/lib/supabase/server';
import { recordAccess } from './access';

export type Result = { ok: true } | { ok: false; error: string };

/** Turns an invitation into an account.
 *
 *  Everything happens together: the auth user, the app_users row, the
 *  role and its default permissions. An account that exists without a
 *  role is an account nobody decided on. */
export async function acceptInvitation(
  token: string, password: string, firstName: string, surname: string
): Promise<Result> {
  if (password.length < 12) {
    return { ok: false, error: 'A password needs at least twelve characters.' };
  }

  const supabase = await createClient();

  const { data: invite } = await supabase
    .from('user_invitations').select('*').eq('token', token).maybeSingle();

  if (!invite) return { ok: false, error: 'That invitation could not be found.' };
  if (invite.status !== 'Sent') {
    return { ok: false, error: 'That invitation is no longer open.' };
  }
  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from('user_invitations')
      .update({ status: 'Expired' }).eq('id', invite.id);
    return { ok: false, error: 'That invitation has expired. Ask for another.' };
  }

  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: { data: { first_name: firstName, surname } },
  });

  if (signUpError || !signUp.user) {
    return { ok: false, error: signUpError?.message ?? 'Could not create the account.' };
  }

  const { data: appUser, error: rowError } = await supabase.from('app_users').insert({
    auth_user_id: signUp.user.id,
    email: invite.email,
    first_name: firstName || invite.first_name,
    surname: surname || invite.surname,
    status: 'Active',
  }).select('id').single();

  if (rowError || !appUser) {
    return { ok: false, error: 'The account was created but the record failed. Tell Kate.' };
  }

  // The role, then its default areas — through the same function the
  // People screen uses, so an invited account and a granted one end up
  // identical rather than nearly identical. Nearly identical is how one
  // of them ends up missing an area nobody notices for a month.
  await supabase.from('user_roles')
    .insert({ app_user_id: appUser.id, role: invite.role });

  await supabase.rpc('apply_role_defaults', {
    p_app_user_id: appUser.id, p_role: invite.role,
  });

  await supabase.from('user_invitations').update({
    status: 'Accepted',
    accepted_at: new Date().toISOString(),
    accepted_user_id: appUser.id,
  }).eq('id', invite.id);

  await recordAccess('Signed in', invite.email, signUp.session?.access_token?.slice(0, 36));

  // Somebody now has access. Worth knowing without checking.
  const { notifyAccountChange } = await import('./notify');
  await notifyAccountChange('An account was created',
    `${firstName} ${surname} (${invite.email}) accepted their invitation and now has `
    + `${invite.role} access.`);

  return { ok: true };
}
