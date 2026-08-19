'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type State = { ok?: boolean; error?: string } | null;

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
