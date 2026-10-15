'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { notify, report } from '@/lib/notify';

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

   This is a sign-up finishing, not a reset completing, so it ends the
   way every other sign-up ends: the welcome email from the portal's own
   library, and the portal told a new account exists. Those two steps
   used to hang off `type === 'signup'` in /auth/confirm alone, and this
   path arrives as a recovery — so a person who came this way got a
   marketplace account, no welcome, and no alert to anybody at TGS. The
   mechanism differing is ours to deal with; the experience should not
   differ at all.
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
     metadata just written. The venue side is untouched: this opens a
     marketplace account, it does not convert anything. */
  await supabase.rpc('ensure_platform_profile');

  /* The same two things every other sign-up does on confirmation.
   *
   * The line about what their account opens is chosen the same way and
   * from the same template, so this email is indistinguishable from the
   * one a brand new address receives. Nothing here refers to Sanctum
   * VMS: a member reading their inbox has signed up for a marketplace
   * account, and that is all this is.
   *
   * Fire and forget, both of them. The account is open either way, and
   * somebody who has just set their password should not be shown an
   * error because a notification could not be delivered. */
  const first = String(user.user_metadata?.first_name ?? '').trim();
  const full = [first, String(user.user_metadata?.surname ?? '').trim()]
    .filter(Boolean).join(' ');
  const origin = (await headers()).get('origin')
    ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';

  const audienceLine = audience === 'host'
    ? 'You told us you are here mainly to host retreats, so we will point you at venues that take them and the people who run them.'
    : audience === 'owner'
      ? 'You told us you are here mainly as a venue owner. If you have a venue to list, we can take you through it whenever you are ready.'
      : 'You told us you are here mainly for wellness experiences, so we will keep you to places and practitioners worth the trip.';

  notify({
    slug: 'account-welcome',
    to: String(user.email ?? ''),
    extra: {
      first_name: first || 'there',
      audience_line: audienceLine,
      account_url: `${origin.replace(/\/$/, '')}/account`,
    },
  });

  report({
    event: 'user.created',
    title: 'A new user account',
    body: `${full || String(user.email ?? 'Someone')} confirmed their email`
      + ` as a ${audience === 'host' ? 'retreat host' : audience === 'owner' ? 'venue owner' : 'wellness guest'}.`,
    url: '/contacts',
  });

  return { ok: true };
}
