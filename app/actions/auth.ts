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
     a sentence they have to act on themselves.

     The kind matters, because the two cases are nothing alike to the
     person reading them. 'platform' is somebody who has done this
     before and forgotten. 'vms' is somebody who registered a venue
     months ago and has never had a marketplace account in their life:
     telling them they already have one would be wrong, and telling them
     to "use your existing login" would be baffling. */
  exists?: boolean;
  kind?: 'platform' | 'vms';
  email?: string;
} | null;

/* Carried from the sign-up form across the sign-in it is interrupted by.
 *
 * Somebody with a VMS login cannot be given a second password, so they
 * have to sign in with the one they have — but they chose an audience
 * and ticked or did not tick the newsletter before that happened, and
 * making them answer twice would be the rudeness the sign-in was
 * already at risk of. Short-lived, http-only, and cleared the moment it
 * is used. */
const PENDING = 'tgs_pending_signup';

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
      .rpc('signup_address_state', { p_email: email });
    const state = String((known as any)?.state ?? 'new');

    /* Somebody who registered a venue months ago, signing up for a
       marketplace account they have never had.
     *
     * They go through sign-up, because that is what they are doing. The
     * form is the same, the confirmation email is the same, and the
     * screen afterwards is the same. What cannot happen underneath is a
     * second auth row — TGS keeps one sign-in per address — so the
     * account is added to the one they have.
     *
     * The password they typed is deliberately discarded rather than
     * stored anywhere until they confirm. That address already protects
     * live venue access, and anyone can type anyone's address into a
     * sign-up form; a password that took effect before the mailbox was
     * proven would hand over a venue. They set it on the other side of
     * the link instead, which is the same strength as the password
     * reset that already exists.
     *
     * The link is a recovery link because that is the mechanism for
     * proving a mailbox on an account that exists. What arrives is not
     * a reset email: the portal picks the template from the redirect
     * below, so it reads as the confirmation it is. */
    if (state === 'vms') {
      (await cookies()).set(PENDING, JSON.stringify({ primary_audience, marketing_opt_in }), {
        path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60,
        secure: process.env.NODE_ENV === 'production',
      });
      const supabaseAnon = await createClient();
      const { error: linkErr } = await supabaseAnon.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl()}/welcome/finish`,
      });
      if (linkErr) return { error: linkErr.message };
      return { sent: true };
    }

    if (state === 'platform') {
      return { exists: true, kind: 'platform', email };
    }
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
  /* Finish a sign-up that was interrupted by this sign-in.
   *
   * Somebody who registered a venue months ago has a login but has
   * never had a marketplace account. They filled in the sign-up form,
   * were asked to sign in because a second password cannot be issued
   * for one address, and are now here. Their answers are written to the
   * account before the profile is built from it, so the audience they
   * chose is the one they get rather than the default. */
  const jar2 = await cookies();
  const pending = jar2.get(PENDING)?.value;
  if (pending) {
    try {
      const choice = JSON.parse(pending) as
        { primary_audience?: string; marketing_opt_in?: boolean };
      await supabase.auth.updateUser({
        data: {
          primary_audience: choice.primary_audience ?? 'guest',
          marketing_opt_in: !!choice.marketing_opt_in,
        },
      });
    } catch (e) {
      console.error('[signIn] could not apply the pending sign-up choices:', e);
    }
    jar2.delete(PENDING);
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
