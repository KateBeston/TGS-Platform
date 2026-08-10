'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { recordAccess } from './access';

export async function signIn(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get('email') ?? '').trim();

  // Checked before anything else, so a script never reaches the password
  // check at all. This closes the gap the rate limit leaves: failures are
  // counted per address, so spraying one password across a hundred
  // addresses never trips it — each sees a single failure.
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const challenge = await verifyTurnstile(
    String(formData.get('cf-turnstile-response') ?? ''), ip);

  if (!challenge.ok) {
    await recordAccess('Failed', email, undefined, `Challenge failed — ${challenge.reason}`);
    return { error: challenge.reason };
  }

  // Repeated failures slow down and then stop. Temporary rather than
  // permanent — a permanent lock means anybody who knows an address can
  // lock its owner out, which turns a defence into an attack.
  const { data: gate } = await supabase.rpc('login_blocked', { p_email: email });
  const blocked = gate as { blocked?: boolean; slow?: boolean; try_again_in?: number } | null;

  if (blocked?.blocked) {
    await recordAccess('Failed', email, undefined, 'Blocked — too many attempts');
    return {
      error: `Too many attempts. Try again in ${blocked.try_again_in} minute`
        + `${blocked.try_again_in === 1 ? '' : 's'}, or reset your password.`,
    };
  }

  // A pause after four failures. Enough to make a script uneconomic and
  // short enough that a person mistyping does not notice.
  if (blocked?.slow) {
    await new Promise((r) => setTimeout(r, 2000));
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get('password') ?? ''),
  });

  if (error) {
    // Recorded against the address even where no account exists —
    // somebody trying an unregistered address is the interesting case,
    // and dropping it for want of a user row loses exactly that.
    await recordAccess('Failed', email, undefined, error.message);
    // The message stays vague on purpose. "No account with that email"
    // tells somebody which addresses are worth trying.
    return { error: 'That email and password do not match an account.' };
  }

  // The session token's opening characters, so a sign-out can be paired
  // with its sign-in. Not the token itself — that would be a credential
  // sitting in a log.
  await recordAccess('Signed in', email, data.session?.access_token?.slice(0, 36));

  // Whether the account is still allowed in, which is separate from
  // whether the password was right. Somebody who has left keeps their
  // password.
  const { data: appUser } = await supabase
    .from('app_users').select('status').ilike('email', email).maybeSingle();

  if (appUser && appUser.status !== 'Active') {
    await supabase.auth.signOut();
    return { error: 'That account is no longer active. Speak to whoever set it up.' };
  }

  redirect('/home');
}

export async function signOut() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();

  if (user?.email) {
    await recordAccess('Signed out', user.email,
                       session?.access_token?.slice(0, 36));
  }

  await supabase.auth.signOut();
  redirect('/login');
}


/** Ends a session that ran out rather than being closed.
 *
 *  Recorded as its own kind of event, because "left idle" and "chose to
 *  sign out" are different facts about the same person and the log is
 *  worth less if it cannot tell them apart.
 */
export async function timedOut(reason: 'Timed out' | 'Session ended') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();

  if (user?.email) {
    await recordAccess(reason as any, user.email,
                       session?.access_token?.slice(0, 36));
  }

  await supabase.auth.signOut();
  redirect('/login?ended=' + (reason === 'Timed out' ? 'idle' : 'limit'));
}
