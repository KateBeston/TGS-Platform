'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

function humanise(m: string) {
  if (/duplicate key/i.test(m)) return 'That record already exists.';
  if (/violates foreign key/i.test(m)) return 'Referenced record not found.';
  return m;
}

/** Creates the app_users row for whoever is signed in.
 *  The first person to do this becomes Administrator — otherwise nobody
 *  can grant anything to anyone and the system is locked from the start. */
export async function claimMyAccount(): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: existing } = await supabase
    .from('app_users').select('id').eq('auth_user_id', user.id).maybeSingle();
  if (existing) return { ok: true, message: 'Account already linked.' };

  const { count } = await supabase.from('app_users').select('*', { count: 'exact', head: true });
  const isFirst = (count ?? 0) === 0;

  const { data: created, error } = await supabase
    .from('app_users')
    .insert({ auth_user_id: user.id, email: user.email, status: 'Active' })
    .select('id').single();

  if (error) return { ok: false, error: humanise(error.message) };

  if (isFirst) {
    await supabase.from('user_roles').insert({ app_user_id: created.id, role: 'Administrator' });
  }

  revalidatePath('/settings/users');
  return { ok: true, message: isFirst ? 'Linked, and granted Administrator as the first account.' : 'Linked.' };
}

export async function setUserField(
  appUserId: number, column: string, value: string | null
): Promise<Result> {
  const allowed = new Set(['first_name', 'surname', 'phone', 'department', 'status']);
  if (!allowed.has(column)) return { ok: false, error: `"${column}" is not editable.` };

  const supabase = await createClient();
  const { error } = await supabase.from('app_users').update({ [column]: value }).eq('id', appUserId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/settings/users');
  return { ok: true };
}

export async function setRole(appUserId: number, role: string, grant: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = grant
    ? await supabase.from('user_roles').upsert({ app_user_id: appUserId, role })
    : await supabase.from('user_roles').delete().eq('app_user_id', appUserId).eq('role', role);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/settings/users');
  return { ok: true };
}

/** One tickbox, two consumers: this row is read by the interface to decide
 *  what to render and by has_area() inside RLS to decide what to return. */
export async function setPermission(
  appUserId: number, areaId: number, canView: boolean, canEdit: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('user_permissions').upsert({
    app_user_id: appUserId, area_id: areaId,
    can_view: canEdit ? true : canView,   // edit implies view
    can_edit: canEdit,
  });
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/settings/users');
  return { ok: true };
}

/** Invite requires Supabase's admin API and therefore the service role key.
 *  It runs only on the server and the key must NOT carry a NEXT_PUBLIC_
 *  prefix. If the variable is absent, create the login in the Supabase
 *  dashboard instead and link it here — both routes work. */
export async function inviteUser(email: string): Promise<Result> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, error: 'An email address is required.' };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return {
      ok: false,
      error: 'Invites are not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel (server-side, no NEXT_PUBLIC_ prefix), or create the login in the Supabase dashboard and link it here.',
    };
  }

  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.inviteUserByEmail(clean);
  if (error) return { ok: false, error: humanise(error.message) };

  const supabase = await createClient();
  await supabase.from('app_users').insert({
    auth_user_id: data.user?.id, email: clean, status: 'Invited',
    invite_sent_at: new Date().toISOString(),
  });

  revalidatePath('/settings/users');
  return { ok: true, message: `Invitation sent to ${clean}.` };
}

/** Sends a reset link to another user. Uses the public key and the standard
 *  recovery flow, so no admin access is needed — and the user sets their own
 *  password rather than an administrator ever knowing it. */
export async function sendPasswordReset(email: string, origin: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: `Reset link sent to ${email}.` };
}
