'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';

// State carries ok / error / sent / needsMfa / exists across auth actions
type State = {
  error?: string; sent?: boolean; ok?: boolean; needsMfa?: boolean;
  /* The address already has a MARKETPLACE account. Kept separate from
     error so the form can hand them to sign-in with it filled in rather
     than printing a sentence they have to act on themselves.

     Only a marketplace account counts. An address known to Sanctum VMS
     and nothing else belongs to somebody who has never had a marketplace
     account in their life, and they are sent through sign-up like anyone
     else: Sanctum VMS and a marketplace account are separate products
     with separate purposes, and nothing user-facing treats one as the
     other or mentions the two in the same breath. */
  exists?: boolean;
  email?: string;
} | null;

/* Carried from the sign-up form across the email that confirms it.
 *
 * Who they are and what they are here for are answered on the form, but
 * none of it can be written until the mailbox is proven. Supabase applies
 * `options.data` only when it creates a row, so for an address it has
 * seen before the answers would be dropped on the floor. Carrying them
 * here means one code path for both, and nobody is asked twice.
 *
 * Short-lived, http-only, and cleared the moment it is used. It holds no
 * password: see signUp below for why there is none to hold. */
const PENDING = 'tgs_pending_signup';

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.theglobalsanctum.com';

export async function signUp(_prev: State, formData: FormData): Promise<State> {
  // Honeypot: a hidden field a person never sees. Answered with the same
  // "check your email" as a real sign-up so a script learns nothing.
  if (String(formData.get('hp_field') ?? '').trim()) return { sent: true };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const first_name = String(formData.get('first_name') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();
  const primary_audience = String(formData.get('primary_audience') ?? 'guest');
  const marketing_opt_in = formData.get('marketing_opt_in') === 'on';

  if (!email) return { error: 'An email address is required.' };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const challenge = await verifyTurnstile(String(formData.get('cf-turnstile-response') ?? ''), ip);
  if (!challenge.ok) return { error: challenge.reason };

  /* Does this address already have a MARKETPLACE account?
   *
   * The only question worth asking, and the only one asked. A platform
   * account means a profile row or a wellness_guest/retreat_host role.
   * Venue access and the venue_owner role are not consulted: Sanctum VMS
   * is a separate product, and whether somebody uses it has no bearing on
   * whether they may sign up here.
   *
   * Asked on the server, and only once the Turnstile challenge above has
   * passed, so the question cannot be put to the database in a loop. The
   * function is revoked from the publishable key, so this server is the
   * only thing that can ask it.
   *
   * A failure to answer is not a failure to sign up: if the check breaks,
   * the sign-up carries on and the worst case is a confirmation email to
   * somebody who already had an account. */
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const { data: known } = await createAdminClient()
      .rpc('signup_address_state', { p_email: email });

    /* Already a member: hand them to sign-in with the address filled in.
       This is the one and only case that redirects. */
    if (String((known as any)?.state ?? 'new') === 'platform') {
      return { exists: true, email };
    }
  } catch (e) {
    console.error('[signUp] could not check whether the address is known:', e);
  }

  /* NO PASSWORD IS TAKEN ON THIS FORM, and that is the whole design.
   *
   * Supabase keeps one password per email address. Writing one here would
   * write it for every product that address opens — so a venue owner
   * signing up for a marketplace account would have the password that
   * opens Sanctum VMS quietly replaced, discover it a week later, and have
   * no way of connecting the two events. The products are separate; the
   * password store underneath is not, and the only safe response is to
   * never write a password for an address that already has one.
   *
   * So the mailbox is proven first and the password comes after, which is
   * the same shape as every modern sign-up. One call covers both cases:
   * for a new address Supabase creates the row and applies the answers
   * from `data`; for an address it has seen, it sends the link and changes
   * nothing. Neither branch can touch an existing password.
   *
   * The answers are also written to the cookie, because `data` is applied
   * only on creation and the far side needs them either way. */
  const answers = JSON.stringify({ first_name, surname, primary_audience, marketing_opt_in });
  (await cookies()).set(PENDING, answers, {
    path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { first_name, surname, primary_audience, marketing_opt_in },
      emailRedirectTo: `${siteUrl()}/welcome/finish`,
    },
  });
  if (error) return { error: error.message };
  return { sent: true };
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

  /* NO SECOND FACTOR ON THE MARKETPLACE.
   *
   * This used to read the assurance level and prompt for a code whenever
   * it could reach aal2 — which is whenever the account has a verified
   * factor, wherever that factor was enrolled. One auth row per address
   * means a venue owner who set up an authenticator for Sanctum VMS was
   * challenged for it to look at saved venues on the marketplace, which
   * is not what a second factor was attached for.
   *
   * Two-factor is a requirement of the internal portal, and the portal
   * enforces it for itself: lib/supabase/middleware.ts checks the level
   * on every request and refuses anything below aal2. So a session minted
   * here at aal1 cannot reach the portal, whatever this function does.
   *
   * Sanctum VMS does NOT check the level per request. A venue owner with
   * a factor can therefore reach the VMS from a marketplace sign-in
   * without entering a code. That is a gap in the VMS rather than
   * something to fix by challenging marketplace members — the same check
   * the portal already makes belongs in the VMS middleware.
   */
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
