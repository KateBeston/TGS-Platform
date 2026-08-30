'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTgsAcceptanceDocs, fetchVenueAcceptanceDocs } from '@/lib/acceptance';
import { checkStay, stayRulesFrom } from '@/lib/stayRules';

/* ═══════════════════════════════════════════════════════════════════════════
   ORDER WRITE PATH  (request-to-book, held pending calendar + payment)

   Turns the client cart into authoritative records: one `order`, a `booking`
   per venue, and a `booking_item` per line. Created with status 'Pending' —
   real, held, not yet confirmed, no money taken.

   TRUST NOTHING FROM THE CLIENT. Every price is recomputed here from the
   database (services/experiences from base_price). Rooms and whole-venue lines
   carry no rate data yet (0 rate plans), so they are captured unpriced with
   item_status 'Requested', to be priced at confirmation. Commission is read
   from the venue's subscription. Cancellation policy is stamped from the venue's
   active default. Guest identity comes from the auth session if present, never
   from the client payload.
   ═══════════════════════════════════════════════════════════════════════════ */

type CartItem = { kind: string; id: number; label?: string; qty?: number; detail?: string };
type CartVenueSlice = {
  venueName?: string; currency?: string | null; from?: string; to?: string;
  guests?: string; items?: CartItem[];
};
type Cart = { venues?: Record<string, CartVenueSlice> };
type Contact = { name?: string; email?: string; phone?: string };
export type SubmitResult = { ok: true; orderReference: string } | { ok: false; error: string };

const ITEM_TYPE: Record<string, string> = { room: 'Room', exp: 'Service', extra: 'Extra', buyout: 'Whole Venue' };
const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : NaN);

function orderRef(): string {
  const s = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `TGS-${s}${r}`;
}

export async function submitBooking(
  cart: Cart,
  contact: Contact,
  acknowledged: string[] = [],
): Promise<SubmitResult> {
  // ── validate the request ──
  const name = (contact?.name ?? '').trim();
  const email = (contact?.email ?? '').trim().toLowerCase();
  if (!name) return { ok: false, error: 'Please add a name for the booking.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Please add a valid email address.' };

  const venues = Object.entries(cart?.venues ?? {}).filter(([, v]) => (v.items?.length ?? 0) > 0);
  if (venues.length === 0) return { ok: false, error: 'Your booking is empty.' };

  // guest identity from the session, never the client
  const authed = await createClient();
  const { data: { user } } = await authed.auth.getUser();

  const db = createAdminClient();

  // Account link is by email (see get_my_platform_activity): a booking attaches
  // to the signed-in user when guest_email matches their auth email. Resolve the
  // wellness_guests row too when one exists (bigint id), else leave null.
  let wellnessGuestId: number | null = null;
  let linkEmail = email; // contact email for guests
  if (user?.email) {
    linkEmail = user.email; // guarantees the My Bookings email match
    const { data: wg } = await db.from('wellness_guests').select('id').ilike('email', user.email).maybeSingle();
    wellnessGuestId = (wg?.id as number) ?? null;
  }

  // ── resolve the venue id for each slice, and server-side prices for services ──
  const venueNames = venues.map(([, v]) => v.venueName).filter(Boolean) as string[];
  const expIds = venues.flatMap(([, v]) => (v.items ?? []).filter((i) => i.kind === 'exp' || i.kind === 'extra').map((i) => i.id));

  // price map for services/experiences (base_price), from both sources
  const priceMap = new Map<number, { price: number | null; currency: string | null }>();
  if (expIds.length) {
    const [{ data: svc }, { data: exp }] = await Promise.all([
      db.from('venue_services').select('id, base_price, currency, venue_id').in('id', expIds),
      db.from('experience_cards').select('id, base_price, currency, venue_id').in('id', expIds),
    ]);
    for (const r of exp ?? []) priceMap.set(r.id, { price: r.base_price, currency: r.currency });
    for (const r of svc ?? []) priceMap.set(r.id, { price: r.base_price, currency: r.currency }); // services authoritative
  }

  // venue ids + commission + cancellation policy, keyed by venue name
  const { data: venueRows } = await db.from('venues').select('id, venue_name').in('venue_name', venueNames);
  const venueByName = new Map((venueRows ?? []).map((v) => [v.venue_name as string, v.id as number]));
  const venueIds = Array.from(venueByName.values());

  const [{ data: subs }, { data: policies }, { data: settings }, { data: venueMinimums }] = await Promise.all([
    db.from('venue_subscriptions').select('venue_id, commission_rate').in('venue_id', venueIds),
    db.from('cancellation_policies').select('id, venue_id').in('venue_id', venueIds).eq('is_default', true).eq('is_active', true),
    db.from('venue_booking_settings')
      .select('venue_id, minimum_stay_default, minimum_stay_weekends, maximum_stay, max_advance_days, advance_notice_hours')
      .in('venue_id', venueIds),
    db.from('venues').select('id, minimum_stay_nights').in('id', venueIds),
  ]);
  const commissionByVenue = new Map((subs ?? []).map((s) => [s.venue_id as number, Number(s.commission_rate ?? 20)]));
  const policyByVenue = new Map((policies ?? []).map((p) => [p.venue_id as number, p.id as number]));
  const settingsByVenue = new Map((settings ?? []).map((r) => [r.venue_id as number, r]));
  const minimumByVenue = new Map((venueMinimums ?? []).map((r) => [r.id as number, r.minimum_stay_nights as number | null]));

  /* Pre-booking steps, re-resolved server-side.
   *
   * The screens set a flag in localStorage, which is a convenience for the
   * guest and no kind of evidence. Anyone can edit it, and a direct POST skips
   * the screens entirely. So the steps are resolved again here, against the
   * same database function the screens used, and a booking whose steps are
   * outstanding is refused. This is the gate; the redirect on the checkout
   * page is only so the journey makes sense. */
  {
    // `venues` is entries, not values: [key, slice] pairs.
    const slices = venues.map(([, v]) => v);
    const serviceIds = slices
      .flatMap((v) => v.items ?? [])
      .filter((i) => i.kind === 'exp' && typeof i.id === 'number')
      .map((i) => i.id as number);
    // Only the line items count here. The cart carries a `buyout` UI flag too,
    // but that is client state; the item is what is actually being booked.
    const hasHire = slices.some((v) => (v.items ?? []).some((i) => i.kind === 'buyout'));
    // Venues with accommodation in the cart. Whether that is a hire is decided
    // by venue_category in the resolver, not here.
    const roomVenueIds = venues
      .filter(([, v]) => (v.items ?? []).some((i) => i.kind === 'room'))
      .map(([name]) => venueByName.get(name))
      .filter((n): n is number => typeof n === 'number');

    const { data: required } = await db.rpc('booking_steps', {
      p_venue_ids: venueIds,
      p_service_ids: Array.from(new Set(serviceIds)),
      p_has_hire: hasHire,
      p_room_venue_ids: Array.from(new Set(roomVenueIds)),
    });

    const needed = Array.from(new Set(((required ?? []) as { step: string }[]).map((r) => r.step)));
    const missing = needed.filter((n) => !(acknowledged ?? []).includes(n));
    if (missing.length) {
      return {
        ok: false,
        error: missing.includes('host')
          ? 'Please review the hire responsibilities before booking.'
          : 'Please review the health and safety notes before booking.',
      };
    }
  }

  /* Dates the venue will not accept, checked before anything is written.
   *
   * The picker already refuses these, but a cart lives in localStorage and a
   * server action is a public endpoint, so the browser's word is not evidence.
   * Refused up front rather than mid-loop: a rejected booking should leave no
   * half-written order behind. */
  for (const [, slice] of venues) {
    const vid = slice.venueName ? venueByName.get(slice.venueName) : undefined;
    if (!vid || !slice.from) continue;
    const rules = stayRulesFrom(settingsByVenue.get(vid), minimumByVenue.get(vid) ?? null);
    const isStay = (slice.items ?? []).some((i) => i.kind === 'room' || i.kind === 'buyout');
    const verdict = checkStay(rules, slice.from, slice.to ?? null, isStay);
    if (!verdict.ok) {
      return { ok: false, error: `${slice.venueName}: ${verdict.error}` };
    }
  }

  // ── create the order ──
  const currency = venues[0][1].currency || 'AUD';
  const reference = orderRef();
  const { data: order, error: orderErr } = await db.from('orders').insert({
    status: 'Pending', currency, order_reference: reference,
    booked_by_type: 'Wellness Guest', wellness_guest_id: wellnessGuestId,
    venue_count: venues.length, notes: contact?.phone ? `Phone: ${contact.phone}` : null,
  }).select('id').single();
  if (orderErr || !order) return { ok: false, error: orderErr?.message ?? 'Could not open the order.' };

  let orderSubtotal = 0;

  // ── a booking per venue, a booking_item per line ──
  for (const [key, slice] of venues) {
    const venueId = venueByName.get(slice.venueName ?? '') ?? null;
    if (!venueId) continue; // can't file a booking without a resolved venue
    const commissionRate = commissionByVenue.get(venueId) ?? 20;
    const policyId = policyByVenue.get(venueId) ?? null;

    const items = slice.items ?? [];
    let bookingSubtotal = 0;
    const lineRows: any[] = [];

    for (const it of items) {
      const qty = Math.max(1, Math.floor(num(it.qty) || 1));
      const priced = (it.kind === 'exp' || it.kind === 'extra') ? priceMap.get(it.id) : undefined;
      const unit = priced && priced.price != null ? Number(priced.price) : null; // rooms/buyout: null (no rates yet)
      const lineTotal = unit != null ? unit * qty : null;
      if (lineTotal != null) bookingSubtotal += lineTotal;
      lineRows.push({
        item_type: ITEM_TYPE[it.kind] ?? 'Add-on',
        item_id: it.id, label: it.label ?? null,
        quantity: qty, unit_price: unit, line_total: lineTotal,
        date_from: slice.from || null, date_to: slice.to || null,
        item_status: 'Requested', currency,
      });
    }

    const commissionAmount = Math.round(bookingSubtotal * (commissionRate / 100) * 100) / 100;
    const { data: booking, error: bErr } = await db.from('bookings').insert({
      order_id: order.id, venue_id: venueId,
      booked_by_type: 'Wellness Guest', status: 'Pending',
      created_by_type: 'Guest self-serve', created_via: 'Booked on the site',
      date_from: slice.from || null, date_to: slice.to || null,
      guest_count: slice.guests ? Number(slice.guests) : null,
      guest_name: name, guest_email: linkEmail, guest_phone: contact?.phone?.trim() || null,
      wellness_guest_id: wellnessGuestId,
      cancellation_policy_id: policyId,
      commission_rate: commissionRate, commission_amount: commissionAmount,
      subtotal: bookingSubtotal, total: bookingSubtotal, currency, is_primary_booking: true,
    }).select('id').single();
    if (bErr || !booking) return { ok: false, error: bErr?.message ?? 'Could not create a booking.' };

    if (lineRows.length) {
      const withBooking = lineRows.map((r) => ({ ...r, booking_id: booking.id }));
      const { error: liErr } = await db.from('booking_items').insert(withBooking);
      if (liErr) return { ok: false, error: liErr.message };
    }
    orderSubtotal += bookingSubtotal;
  }

  await db.from('orders').update({ subtotal: orderSubtotal, total: orderSubtotal }).eq('id', order.id);

  /* Record what was accepted, against this order.
   *
   * Re-read from the same views the checkout page displayed rather than
   * trusting a list from the client, so the record is of documents that were
   * actually in force at this moment. Each row snapshots the version label,
   * effective date, body length and body hash, so the exact wording can be
   * proven later even if the document is superseded.
   *
   * Deliberately last, and deliberately non-fatal: a booking that exists with
   * no acceptance row is recoverable, a lost booking is not. */
  try {
    const bookedVenueIds = Array.from(new Set(venueIds.filter((n): n is number => typeof n === 'number')));
    const [tgsDocs, venueDocs] = await Promise.all([
      fetchTgsAcceptanceDocs(db as never),
      fetchVenueAcceptanceDocs(db as never, bookedVenueIds),
    ]);

    if (tgsDocs.length || venueDocs.length) {
      const h = await headers();
      const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
      const ua = h.get('user-agent') ?? null;
      const base = {
        order_id: order.id,
        signatory_name: name,
        signatory_email: linkEmail,
        party_type: 'Wellness Guest',
        source: 'Checkout',
        ip_address: ip,
        user_agent: ua,
      };
      const rows = [
        ...tgsDocs.map((d) => ({
          ...base, version_id: d.version_id, venue_id: null,
          version_label_at_acceptance: d.version_label,
          effective_from_at_acceptance: d.effective_from,
          body_sha256: d.body_sha256, body_length: d.body_length,
          notes: `Order ${reference}`,
        })),
      ];
      if (rows.length) await db.from('legal_acceptances').insert(rows);

      /* Venue documents live in their own register, so they are recorded
         against venue_legal_acceptances, because legal_acceptances.version_id
         points at the TGS register and cannot carry a venue document. */
      if (venueDocs.length) {
        await db.from('venue_legal_acceptances').insert(
          venueDocs.map((d) => ({
            order_id: order.id, venue_id: d.venue_id,
            venue_legal_document_version_id: d.version_id,
            signatory_name: name, signatory_email: linkEmail,
            source: 'Checkout', ip_address: ip, user_agent: ua,
            version_label_at_acceptance: d.version_label,
            effective_from_at_acceptance: d.effective_from,
            body_sha256: d.body_sha256, body_length: d.body_length,
            notes: `Order ${reference}`,
          })),
        );
      }
    }
  } catch { /* never fail a booking over the audit trail */ }

  return { ok: true, orderReference: reference };
}
