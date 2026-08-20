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
  const { error } = await supabase.from('profiles').update({
    primary_audience: (audience === 'host' ? 'host' : 'guest'),
  }).eq('id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/account');
  return { ok: true };
}

export async function updateComms(_prev: State, formData: FormData): Promise<State> {
  const { supabase, user } = await me();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await supabase.from('profiles').update({
    marketing_opt_in: formData.get('marketing_opt_in') != null,
  }).eq('id', user.id);
  if (error) return { error: error.message };
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
