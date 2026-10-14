'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/* ═══════════════════════════════════════════════════════════════════════
   THE OTHER SIDE OF A SIGN-UP THAT COULD NOT ISSUE A SECOND LOGIN

   Somebody who registered a venue months ago, signing up for a
   marketplace account they have never had. They filled in the sign-up
   form and confirmed by email, which is the only thing that proves the
   mailbox is theirs — and it has to be proven, because that address
   already protects live venue access and anyone can type anyone's
   address into a sign-up form.

   They arrive here with a session from the link. Setting the password
   here rather than taking the one from the form is the whole point: a
   password that took effect before the mailbox was proven would hand a
   stranger somebody's venue.
   ═══════════════════════════════════════════════════════════════════════ */

type State = { error?: string; ok?: boolean } | null;

const PENDING = 'tgs_pending_signup';

export async function finishSignup(_prev: State, formData: FormData): Promise<State> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');

  if (password.length < 8) return { error: 'Please use at least 8 characters for your password.' };
  if (password !== confirm) return { error: 'The two passwords don’t match.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'That link has expired. Start the sign-up again and we will send a fresh one.' };
  }

  /* The choices they made on the sign-up form, carried across the
     confirmation. Applied to the account before the profile is built
     from it, so the audience they picked is the one they get. */
  const jar = await cookies();
  const pending = jar.get(PENDING)?.value;
  let audience = 'guest';
  let marketing = false;
  if (pending) {
    try {
      const c = JSON.parse(pending) as { primary_audience?: string; marketing_opt_in?: boolean };
      audience = c.primary_audience ?? 'guest';
      marketing = !!c.marketing_opt_in;
    } catch { /* the defaults stand */ }
  }

  const { error } = await supabase.auth.updateUser({
    password,
    data: { primary_audience: audience, marketing_opt_in: marketing },
  });
  if (error) return { error: error.message };

  jar.delete(PENDING);

  /* Builds the profile, the platform role and the contact link from the
     metadata just written. The venue side is untouched: this adds an
     account, it does not convert one. */
  await supabase.rpc('ensure_platform_profile');

  return { ok: true };
}
