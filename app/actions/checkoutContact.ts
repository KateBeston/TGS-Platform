'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/* The checkout contact step, written down.
 *
 * The checkout has always required a first name and an email before the
 * Request to book button enables, but those details only went into the
 * browser's own storage and reached the server at the final submit. A
 * guest who filled the form in and then left was an anonymous session
 * with nothing behind it: no contact in the portal, nothing to attribute
 * the cart to, and nothing for an abandoned cart to be sent to.
 *
 * This records the person at the moment they identify themselves, which
 * is where a normal checkout does it, because knowing who is buying is
 * part of the purchase rather than an extra.
 *
 * Deliberately returns nothing but ok. The contact id stays on the
 * server: handing it back would tell a browser which addresses are
 * already on file.
 */
export async function recordCheckoutContact(input: {
  first?: string | null;
  last?: string | null;
  email: string;
  phone?: string | null;
  sessionId?: string | null;
  /* Optional and unticked by default. Consent has to be actively given,
     so a pre-ticked or bundled box is not consent at all. */
  marketing?: boolean | null;
  /* The wording as it was shown on screen, stored with the consent. A
     record that does not say what somebody agreed to proves nothing. */
  consentText?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const email = String(input?.email ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'That does not look like an email address.' };
  }

  /* Trimmed and capped. These land in a record a human will read, and an
     unbounded string from a form is not something to hand onwards. */
  const clean = (v: unknown, max: number): string | null => {
    const s = String(v ?? '').trim();
    return s ? s.slice(0, max) : null;
  };

  /* Who they are is read from the session on the server, not taken from
     the browser's word for it. Somebody signed in is matched to their own
     account's contact whatever address they typed into the form, so their
     bookings stay on the record their account reads from. */
  let authUser: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    authUser = user?.id ?? null;
  } catch { /* not signed in, which is the ordinary case here */ }

  /* Our own session token from sessionStorage. The shape is checked
     because it reaches a query that attaches a cart to a person. */
  const sid = clean(input.sessionId, 64);
  const sessionId = sid && /^[A-Za-z0-9._-]{8,64}$/.test(sid) ? sid : null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('contact_for_checkout', {
      p_email: email,
      p_first: clean(input.first, 80),
      p_surname: clean(input.last, 80),
      p_phone: clean(input.phone, 40),
      p_session_id: sessionId,
      p_auth_user: authUser,
      /* Only ever true or false from the box itself, and the database
         only ever grants on true — it never withdraws a consent given
         somewhere else because somebody left the box alone here. */
      p_marketing: input.marketing === true,
      p_consent_text: input.marketing === true ? clean(input.consentText, 500) : null,
    });

    if (error) return { ok: false, error: error.message };

    const row = data as { ok?: boolean; error?: string } | null;
    if (row && row.ok === false) {
      return { ok: false, error: row.error ?? 'Could not record the contact.' };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not record the contact.',
    };
  }
}
