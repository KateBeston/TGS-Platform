'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const tidy = (m: string) => m.replace(/^.*?ERROR:\s*/, '').trim();

export async function roleDefinitions() {
  const supabase = await createClient();
  const { data } = await supabase.from('role_definitions')
    .select('*').order('rank', { ascending: false });
  return data ?? [];
}

export async function peopleAccess() {
  const supabase = await createClient();
  const { data } = await supabase.from('people_access')
    .select('*').order('rank', { ascending: false, nullsFirst: false });
  return data ?? [];
}

export async function myRank() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('user_rank');
  return Number(data ?? 0);
}

/** Grants a role and its default permissions.
 *
 *  Refuses a role at or above the granter's own — enforced in the
 *  database, because an interface is a suggestion. */
export async function grantRole(
  appUserId: number, role: string, note?: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('grant_role', {
    p_app_user_id: appUserId, p_role: role, p_note: note ?? null,
  });
  if (error) return { ok: false, error: tidy(error.message) };

  // A role grant reaches every venue record. Silence is the wrong
  // default for that.
  const { notifyAccountChange } = await import('./notify');
  await notifyAccountChange('A role was granted',
    `${role} was granted to account ${appUserId}${note ? ` — ${note}` : ''}.`);

  revalidatePath('/settings/users');
  return { ok: true, message: 'Role granted, with its default areas.' };
}

export async function revokeRole(
  appUserId: number, role: string, note?: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_role', {
    p_app_user_id: appUserId, p_role: role, p_note: note ?? null,
  });
  if (error) return { ok: false, error: tidy(error.message) };

  const { notifyAccountChange } = await import('./notify');
  await notifyAccountChange('A role was removed',
    `${role} was removed from account ${appUserId}${note ? ` — ${note}` : ''}.`);

  revalidatePath('/settings/users');
  return { ok: true, message: 'Role removed.' };
}
