'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; codes?: string[] } | { ok: false; error: string };

export async function mfaStatus() {
  const supabase = await createClient();
  const { data } = await supabase.from('mfa_status')
    .select('*').order('rank', { ascending: false, nullsFirst: false });
  return data ?? [];
}

export async function myStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('mfa_status')
    .select('*').eq('email', user.email).maybeSingle();
  return data;
}

/** Ten codes, returned once.
 *
 *  They are hashed on the way in, so this is the only moment they exist
 *  in readable form. Losing them means generating new ones, which
 *  invalidates the old — and that is the correct behaviour, not a
 *  limitation. */
export async function makeRecoveryCodes(): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: appUser } = await supabase.from('app_users')
    .select('id').eq('auth_user_id', user.id).maybeSingle();
  if (!appUser) return { ok: false, error: 'No portal account for this login.' };

  const { data, error } = await supabase.rpc('generate_recovery_codes', {
    p_app_user_id: appUser.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/account');
  return {
    ok: true,
    codes: data as string[],
    message: 'Ten codes. This is the only time they are shown.',
  };
}

/** Marks the codes as having been seen, so the reminder stops. */
export async function codesSeen(): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  await supabase.from('app_users')
    .update({ recovery_codes_seen_at: new Date().toISOString() })
    .eq('auth_user_id', user.id);
  revalidatePath('/account');
  return { ok: true };
}

/** Records that a factor was enrolled.
 *
 *  Supabase knows about the factor; app_users does not, and the whole
 *  question of who still needs to set it up is answered from there. */
export async function markEnrolled(): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).filter((f: any) => f.status === 'verified');

  await supabase.from('app_users')
    .update({ mfa_enrolled_at: verified.length ? new Date().toISOString() : null })
    .eq('auth_user_id', user.id);

  revalidatePath('/account');
  return { ok: true };
}

/** Sets a date by which somebody must have 2FA in place.
 *
 *  A grace period rather than a wall — requiring it the moment an account
 *  is created means somebody sets it up on a borrowed phone in a hurry.
 *  A few days is enough to do it properly and short enough that it
 *  happens. */
export async function setMfaDeadline(
  appUserId: number, days = 7
): Promise<Result> {
  const supabase = await createClient();
  const by = new Date();
  by.setDate(by.getDate() + days);

  const { error } = await supabase.from('app_users')
    .update({ mfa_required_from: by.toISOString().slice(0, 10) })
    .eq('id', appUserId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/users');
  return {
    ok: true,
    message: `Due by ${by.toLocaleDateString('en-AU',
      { day: 'numeric', month: 'long' })}.`,
  };
}
