'use server';

import { createClient } from '@/lib/supabase/server';

/* ═══════════════════════════════════════════════════════════════════════
   HOLDING A TIME WHILE SOMEBODY DECIDES

   Two guests could put the same two o'clock in their carts and both reach
   checkout. The database has had the whole mechanism since it was written
   — slot_holds, hold_service_slot, release_service_hold, cart_holds, and a
   free_slots that subtracts live holds — and the marketplace had never
   called any of it. slot_holds had no rows at all.

   These are the two calls the cart needs. Nothing is decided here: the
   database does the deciding, including whether the time is still on offer
   to this cart, how long a hold lasts (twenty minutes) and how many one
   cart may hold at once. A second call for the same slot extends the hold
   rather than making another, so re-adding or changing the number of people
   is safe.

   Refusals come back as text to show the guest, not as errors. "That time
   is no longer free" is an answer, not a fault, and it is the one that
   matters most: it is what stops the double booking.
   ═══════════════════════════════════════════════════════════════════════ */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HeldSlot =
  | { ok: true; holdId: number; holdsUntil: string }
  | { ok: false; refused: string };

/** Hold one time for this cart, or extend a hold it already has. */
export async function holdSlot(input: {
  venueId: number;
  serviceId: number;
  /** The venue's own date, as YYYY-MM-DD. */
  date: string;
  /** The venue's own start time, as HH:MM. */
  startsLocal: string;
  people: number;
  cartToken: string;
}): Promise<HeldSlot> {
  /* Shapes checked here so a malformed value is a sentence rather than a
     Postgres cast error the guest would see as a broken page. */
  if (!Number.isFinite(input.venueId) || input.venueId <= 0
      || !Number.isFinite(input.serviceId) || input.serviceId <= 0) {
    return { ok: false, refused: 'That experience could not be identified.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, refused: 'That date could not be read.' };
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(input.startsLocal)) {
    return { ok: false, refused: 'That time could not be read.' };
  }
  if (!UUID.test(input.cartToken)) {
    return { ok: false, refused: 'This booking could not be identified.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('hold_service_slot', {
    p_venue_id: input.venueId,
    p_service_id: input.serviceId,
    p_date: input.date,
    p_start: input.startsLocal.length === 5 ? `${input.startsLocal}:00` : input.startsLocal,
    p_people: Math.max(1, Math.floor(input.people) || 1),
    p_cart_token: input.cartToken,
  });

  if (error) {
    /* Not surfaced to the guest as a refusal of their time, because it is
       not one. The slot is almost certainly still free and the hold simply
       did not happen, so they are allowed to carry on — the same race
       everybody ran before holds existed. */
    console.error('[holdSlot] could not hold', input.serviceId, error.message);
    return { ok: false, refused: '' };
  }

  /* A table-returning function comes back as an array of one row. */
  const row = (Array.isArray(data) ? data[0] : data) as
    { hold_id: number | null; holds_until: string | null; refused: string | null } | null;

  if (!row) return { ok: false, refused: '' };
  if (row.refused) return { ok: false, refused: row.refused };
  if (row.hold_id == null || row.holds_until == null) return { ok: false, refused: '' };

  return { ok: true, holdId: Number(row.hold_id), holdsUntil: String(row.holds_until) };
}

/** Keep every time this cart is holding, while the guest is still here.
 *
 *  Twenty minutes is long enough to choose a time and too short to fill in
 *  the health form, read the terms and check out. Nothing extended it, so
 *  a hold lapsed under somebody mid-booking and they found out at submit.
 *
 *  The database decides what may be renewed: live holds only, never a
 *  lapsed one, and nothing more than two hours old. So calling this often
 *  is safe and calling it forever does not work. */
export async function renewHolds(
  cartToken: string,
): Promise<{ renewed: number; holdsUntil: string | null }> {
  if (!UUID.test(cartToken)) return { renewed: 0, holdsUntil: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('renew_cart_holds', {
    p_cart_token: cartToken,
  });

  if (error) {
    /* Not worth telling the guest. A renewal that does not happen leaves
       the hold exactly as it was, which is the position they were in
       before any of this existed. */
    console.error('[renewHolds] could not renew', error.message);
    return { renewed: 0, holdsUntil: null };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    { renewed: number | null; holds_until: string | null } | null;

  return {
    renewed: Number(row?.renewed ?? 0),
    holdsUntil: row?.holds_until ?? null,
  };
}

/** Give a held time back, when it is taken out of the cart. */
export async function releaseSlot(
  cartToken: string, holdId: number,
): Promise<{ ok: boolean }> {
  if (!UUID.test(cartToken) || !Number.isFinite(holdId) || holdId <= 0) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('release_service_hold', {
    p_cart_token: cartToken,
    p_hold_id: holdId,
  });

  if (error) {
    /* Worth a line but not worth telling the guest. An unreleased hold
       expires on its own in twenty minutes, so the cost of this failing is
       one slot looking busy for a little while, not a lost booking. */
    console.error('[releaseSlot] could not release', holdId, error.message);
    return { ok: false };
  }
  return { ok: true };
}
