'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';

// State carries ok / error / sent / needsMfa / exists across auth actions
type State = {
  error?: string; sent?: boolean; ok?: boolean; needsMfa?: boolean;
  /* The address already has an account. Kept separate from error so the
     form can hand them to sign-in with it filled in rather than printing
     a sentence they have to act on themselves. */
  exists?: boolean;
  email?: string;
} | null;

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.theglobalsanctum.com';

export async function signUp(_prev: State, formData: FormData): Promise<State> {
  // Honeypot: a hidden field a person never sees. Answered with the same
  // "check your email" as a real sign-up so a script learns nothing.
  if (String(formData.get('hp_field') ?? '').trim()) return { sent: true };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const first_name = String(formData.get('first_name') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();
  const primary_audience = String(formData.get('primary_audience') ?? 'guest');
  const marketing_opt_in = formData.get('marketing_opt_in') === 'on';

  const confirm = String(formData.get('confirm_password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 8) return { error: 'Please use at least 8 characters for your password.' };
  if (password !== confirm) return { error: 'The two passwords don\u2019t match.' };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const challenge = await verifyTurnstile(String(formData.get('cf-turnstile-response') ?? ''), ip);
  if (!challenge.ok) return { error: challenge.reason };

  /* Already registered?
   *
   * Supabase will not say. It answers a repeat sign-up with the same
   * empty success as a real one and sends nothing, which leaves somebody
   * who already has an account waiting for a link that was never sent.
   *
   * Asked here rather than from the browser, and only once the Turnstile
   * challenge above has passed, so the question cannot be put to the
   * database in a loop. The function itself is revoked from the
   * publishable key, so this server is the only thing that can ask it.
   *
   * A failure to answer is not a failure to sign up: if the check itself
   * breaks, the sign-up carries on as it did before. */
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const { data: known } = await createAdminClient()
      .rpc('email_is_registered', { p_email: email });
    if (known === true) return { exists: true, email };
  } catch (e) {
    console.error('[signUp] could not check whether the address is known:', e);
  }

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
  /* Confirmation is off, or already satisfied, so they are signed in here
     and now. The same call the confirmation link makes, so the contact
     record and the role follow from the form either way. */
  await supabase.rpc('ensure_platform_profile');
  return { ok: true };
}

export async function signIn(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };

  // Remember me: absent checkbox means session-only. The cookie is read where
  // the auth cookies are written (server client + middleware) to drop their
  // max-age, so the session ends when the browser closes.
  const remember = formData.get('remember') != null;
  const jar = await cookies();
  jar.set('tgs_remember', remember ? '1' : '0', {
    path: '/', sameSite: 'lax', maxAge: remember ? 400 * 24 * 60 * 60 : undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
      return { error: 'Please confirm your email first — check your inbox and spam for the link.' };
    }
    return { error: 'That email and password do not match an account.' };
  }
  // Ensure a platform profile exists — covers an owner-first person signing in to
  // browse as a guest (no-op if they already have one).
  await supabase.rpc('ensure_platform_profile');
  // If the account has two-factor enabled, the session is only aal1 until they
  // complete the code challenge — signal the client to prompt for it.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
    return { needsMfa: true };
  }
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
