'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type State = { error?: string; sent?: boolean; ok?: boolean } | null;

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.theglobalsanctum.com';

export async function signUp(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const first_name = String(formData.get('first_name') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();
  const primary_audience = String(formData.get('primary_audience') ?? 'guest');
  const marketing_opt_in = formData.get('marketing_opt_in') === 'on';

  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 8) return { error: 'Please use at least 8 characters for your password.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { first_name, surname, primary_audience, marketing_opt_in },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/account`,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { sent: true };
  return { ok: true };
}

export async function signIn(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'That email and password do not match an account.' };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function requestReset(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Please enter your email.' };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/account`,
  });
  return { sent: true };
}
