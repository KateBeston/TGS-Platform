'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { report } from '@/lib/notify';

/* ═══════════════════════════════════════════════════════════════════════
   A MEMBER CLOSING THEIR OWN ACCOUNT

   Closing clears the marketplace half and keeps the record of it. What it
   does NOT do is delete the login, for the reason that runs through all of
   this: Supabase keeps one auth row per email address, so that login may
   also be somebody's Sanctum VMS access or a TGS staff account. Deleting
   it to tidy a marketplace account would lock a venue owner out of their
   own venue.

   Nor does it touch bookings, enquiries, invoices or ledger entries.
   Those carry this person's id and the accounts would not balance without
   them.

   The order matters and is not arbitrary:

     1  the archive row, which reads the profile and the roles
     2  consent off, so the trigger carries it to the contact record
     3  the contact roles ended, which keeps the history
     4  the marketplace roles and the profile deleted
     5  signed out

   Step 1 has to come first because it records what was there, and steps 4
   and 5 destroy the evidence it is recording.
   ═══════════════════════════════════════════════════════════════════════ */

export type CloseState = { error?: string; ok?: boolean } | null;

export async function closeMyAccount(_prev: CloseState, formData: FormData): Promise<CloseState> {
  /* Typed rather than ticked. A checkbox beside a button is one slip away
     from a closed account; the word has to be meant. */
  const typed = String(formData.get('confirm') ?? '').trim().toLowerCase();
  if (typed !== 'close') {
    return { error: 'Type the word close in the box to confirm.' };
  }
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500) || null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const email = String(user.email ?? '');

  /* 1 — the record of the closure, written before anything is removed.
         It carries the name, the roles held at the time and the date, and
         it is what a returning member is recognised by. */
  const { error: aErr } = await supabase.rpc('close_marketplace_account', {
    p_user_id: user.id,
    p_reason: reason ? `Closed by the member — ${reason}` : 'Closed by the member',
  });
  if (aErr) {
    return { error: `Nothing was closed — the record could not be written: ${aErr.message}` };
  }

  /* 2 — consent off through the profile, because a trigger carries that
         column to the contact record and the profile is about to go. */
  await supabase.from('profiles').update({ marketing_opt_in: false }).eq('id', user.id);

  /* 3 — roles ended rather than erased, the same way every other role
         change works: the record should still say they were a wellness
         guest until today. */
  for (const key of ['wellness_guest', 'retreat_host', 'newsletter']) {
    await supabase.rpc('claim_contact_role', {
      p_role_key: key, p_on: false, p_via: 'Account closed by the member',
    });
  }

  /* 4 — the marketplace account itself. Both deletes reach only this
         person's own rows, and account_roles_own_del covers the two
         marketplace roles only, so a venue_owner row cannot be caught by
         this however it is called. */
  const { error: rErr } = await supabase.from('account_roles')
    .delete().eq('user_id', user.id).in('role', ['wellness_guest', 'retreat_host']);
  if (rErr) return { error: `Your roles could not be removed: ${rErr.message}` };

  const { error: pErr } = await supabase.from('profiles').delete().eq('id', user.id);
  if (pErr) return { error: `Your profile could not be removed: ${pErr.message}` };

  report({
    event: 'user.closed',
    title: 'A member closed their account',
    body: `${email || 'Someone'} closed their marketplace account`
      + `${reason ? `. They said: ${reason}` : '.'}`
      + ' The login is untouched.',
    url: '/contacts',
  });

  /* 5 — out. Staying signed in to an account that no longer exists shows
         an empty shell and reads as a failure. */
  await supabase.auth.signOut();
  (await cookies()).delete('tgs_remember');

  revalidatePath('/');
  revalidatePath('/account');
  return { ok: true };
}
