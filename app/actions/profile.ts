'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Everything about the person signed in, and nothing about anybody
 *  else. */
export async function myProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('app_users')
    .select('*, user_roles(role, role_definitions(name,description,rank))')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!data) return null;

  const { data: perms } = await supabase
    .from('user_permissions')
    .select('can_view, can_edit, permission_areas(area_key,label,description)')
    .eq('app_user_id', data.id);

  return { ...data, authEmail: user.email, permissions: perms ?? [] };
}

/** What somebody may change about themselves.
 *
 *  Deliberately narrow. Not their role, not their permissions, not
 *  whether their account is active — those are somebody else's to grant
 *  and would be pointless to protect elsewhere if a person could set them
 *  here. */
const OWN_COLUMNS = new Set([
  'first_name', 'surname', 'display_name', 'phone', 'job_title',
  'timezone', 'avatar_url', 'company',
]);

export async function saveMyProfile(
  column: string, value: unknown
): Promise<Result> {
  if (!OWN_COLUMNS.has(column)) {
    return { ok: false, error: 'That is not something you can change about yourself.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const patch: Record<string, unknown> = { [column]: value };
  // A display name follows the real one unless it has been set
  // deliberately, so attribution never reads as an email address.
  if (column === 'first_name' || column === 'surname') {
    const { data: me } = await supabase.from('app_users')
      .select('first_name,surname,display_name').eq('auth_user_id', user.id).single();
    const auto = `${me?.first_name ?? ''} ${me?.surname ?? ''}`.trim();
    if (!me?.display_name || me.display_name === auto) {
      const next = column === 'first_name'
        ? `${value ?? ''} ${me?.surname ?? ''}`
        : `${me?.first_name ?? ''} ${value ?? ''}`;
      patch.display_name = next.trim() || null;
    }
  }

  const { error } = await supabase.from('app_users')
    .update(patch).eq('auth_user_id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/account');
  return { ok: true };
}

/** A recovery code, from the sign-in screen.
 *
 *  Somebody who has lost the phone can pass the password step and then
 *  stop, with nowhere to go. This is the way through. */
export async function useRecoveryCode(
  email: string, code: string
): Promise<Result & { codesLeft?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('redeem_recovery_code', {
    p_email: email, p_code: code,
  });
  if (error) return { ok: false, error: error.message };

  const r = data as { ok: boolean; message: string; codes_left?: number };
  return r.ok
    ? { ok: true, message: r.message, codesLeft: r.codes_left }
    : { ok: false, error: r.message };
}
