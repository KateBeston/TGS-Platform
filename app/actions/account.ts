'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type State = { ok?: boolean; error?: string; message?: string } | null;

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function updateProfile(_prev: State, formData: FormData): Promise<State> {
  const { supabase, user } = await me();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await supabase.from('profiles').update({
    first_name: (String(formData.get('first_name') ?? '').trim() || null),
    surname: (String(formData.get('surname') ?? '').trim() || null),
    display_name: (String(formData.get('display_name') ?? '').trim() || null),
    phone: (String(formData.get('phone') ?? '').trim() || null),
  }).eq('id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/account');
  return { ok: true };
}

export async function updatePreferences(_prev: State, formData: FormData): Promise<State> {
  const { supabase, user } = await me();
  if (!user) return { error: 'Please sign in again.' };
  const audience = String(formData.get('primary_audience') ?? '');
  const isHost = audience === 'host';
  const { error } = await supabase.from('profiles').update({
    primary_audience: isHost ? 'host' : 'guest',
  }).eq('id', user.id);
  if (error) return { error: error.message };

  /* Changing what they are here adds the role rather than swapping it.
     Somebody who starts booking sessions and later hosts a retreat is
     both, and taking the first role away because they picked the second
     would lose the history and the marketing that goes with it. Roles are
     removed deliberately, never as a side effect of choosing another. */
  await supabase.rpc('claim_contact_role', {
    p_role_key: isHost ? 'retreat_host' : 'wellness_guest',
    p_on: true,
    p_via: 'Account preferences',
  });

  revalidatePath('/account');
  return { ok: true };
}

export async function updateComms(_prev: State, formData: FormData): Promise<State> {
  const { supabase, user } = await me();
  if (!user) return { error: 'Please sign in again.' };
  const on = formData.get('marketing_opt_in') != null;
  const { error } = await supabase.from('profiles').update({
    marketing_opt_in: on,
  }).eq('id', user.id);
  if (error) return { error: error.message };

  /* Two different things, both needed.
   *
   * The profile tick is consent, and a database trigger carries it to the
   * contact record. The newsletter ROLE is what puts them on the Journal
   * audience, and marketing follows the role — so a tick with no role
   * means somebody who said yes and hears nothing.
   *
   * claim_contact_role reaches only this person's own record and only
   * roles a person is allowed to choose, so this cannot touch anybody
   * else however it is called. */
  await supabase.rpc('claim_contact_role', {
    p_role_key: 'newsletter', p_on: on, p_via: 'Account preferences',
  });

  revalidatePath('/account');
  return { ok: true };
}

export async function changeEmail(_prev: State, formData: FormData): Promise<State> {
  const { supabase, user } = await me();
  if (!user) return { error: 'Please sign in again.' };
  const email = String(formData.get('new_email') ?? '').trim();
  if (!email || !email.includes('@')) return { error: 'Please enter a valid email address.' };
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { error: error.message };
  return { ok: true, message: 'Almost there — check your new email address for a confirmation link. Your login won\u2019t change until you confirm.' };
}

export async function changePassword(_prev: State, formData: FormData): Promise<State> {
  const { supabase, user } = await me();
  if (!user) return { error: 'Please sign in again.' };
  const pw = String(formData.get('new_password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');
  if (pw.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (pw !== confirm) return { error: 'The two passwords don\u2019t match.' };
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  return { ok: true, message: 'Your password has been updated.' };
}

export async function setOrientation(formData: FormData) {
  const { supabase, user } = await me();
  if (!user) redirect('/');
  const kind = formData.get('kind') === 'host' ? 'host' : 'guest';
  await supabase.rpc('set_platform_orientation', { p_kind: kind });
  const to = String(formData.get('redirect_to') ?? '/');
  redirect(to || '/');
}
