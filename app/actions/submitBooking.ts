'use server';

import { headers } from 'next/headers'
import { notify, INTERNAL, askVenueToConfirm, sendSignedCopy } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTgsAcceptanceDocs, fetchVenueAcceptanceDocs, contextsFromBooking } from '@/lib/acceptance';
import { checkStay, stayRulesFrom } from '@/lib/stayRules';
import { stayClashes } from '@/app/actions/availability';

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

type CartItem = {
  kind: string; id: number; label?: string; qty?: number; detail?: string;
  /* Set only where the guest chose a real time from the venue's
     availability. The cart is the guest's own browser storage and cannot be
     trusted on price — but a time is re-checked against free_slots before
     it is filed, below. */
  slotDate?: string; startsLocal?: string; endsLocal?: string;
  startsUtc?: string; slotTz?: string; slotId?: number | null;
};
type CartVenueSlice = {
  venueName?: string; currency?: string | null; from?: string; to?: string;
  guests?: string; items?: CartItem[];
};
type Cart = { venues?: Record<string, CartVenueSlice> };
type Contact = { name?: string; email?: string; phone?: string };
export type SubmitResult = { ok: true; orderReference: string } | { ok: false; error: string };

const ITEM_TYPE: Record<string, string> = { room: 'Room', exp: 'Service',
  /* Its own line type, so a 90-minute booking is told apart from the
     advertised 60 in every report. */
  svclen: 'Service length', extra: 'Extra', buyout: 'Whole Venue',
  /* Both were missing, and both are real line types the database has
     always permitted. Without a key here they fell through to 'Add-on',
     and the price lookup below had no branch for them either — so a guest
     who added a shala hire saw a price in the cart and the order was
     recorded without it. The booking total was short by exactly that
     amount, on every booking that included one. */
  space: 'Space', package: 'Package' };
const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : NaN);

function orderRef(): string {
  const s = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `TGS-${s}${r}`;
}

/** What the agreement panel recorded somebody doing, where one was shown.
 *
 *  Optional, so a caller that does not present the panel still books, and
 *  the acceptance rows are written exactly as they were before. */
export type AgreementEvidence = {
  sectionsRead?: string[];
  typedAffirmation?: string | null;
  signatureKind?: 'drawn' | 'typed' | null;
  signatureName?: string | null;
  signatureImage?: string | null;
};

export async function submitBooking(
  cart: Cart,
  contact: Contact,
  acknowledged: string[] = [],
  agreement: AgreementEvidence | null = null,
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
  /* Kept apart from expIds and looked up in its own map: a duration id and
     a service id are different rows that share numbers, so one map keyed
     on id alone would price a length off whichever service matched. */
  const lenIds = venues.flatMap(([, v]) =>
    (v.items ?? []).filter((i) => i.kind === 'svclen').map((i) => i.id));

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

  /* Lengths, priced from the row the guest actually chose. Server-side
     like the rest: a price posted from a browser is a suggestion. */
  const lenPrice = new Map<number, { price: number | null; currency: string | null }>();
  if (lenIds.length) {
    const { data: lens } = await db.from('venue_service_durations')
      .select('id, price, currency').in('id', lenIds);
    for (const r of lens ?? []) lenPrice.set(r.id, { price: r.price, currency: r.currency });
  }

  /* Spaces and packages, in their own maps for the same reason the
     lengths have one: these are different tables whose ids share numbers,
     and one map keyed on id alone would price a shala off whichever
     package happened to match.

     The cart prices both on the client — a space from hire_price, a
     package from price_per_person — and neither was re-read here, so
     neither reached the order. Re-read from the venue's own row like
     everything else, because a price posted from a browser is a
     suggestion. */
  const spaceIds = venues.flatMap(([, v]) =>
    (v.items ?? []).filter((i) => i.kind === 'space').map((i) => i.id));
  const spacePrice = new Map<number, { price: number | null; currency: string | null }>();
  if (spaceIds.length) {
    const { data: rows } = await db.from('venue_spaces')
      .select('id, hire_price, currency').in('id', spaceIds);
    for (const r of rows ?? []) spacePrice.set(r.id, { price: r.hire_price, currency: r.currency });
  }

  const pkgIds = venues.flatMap(([, v]) =>
    (v.items ?? []).filter((i) => i.kind === 'package').map((i) => i.id));
  const pkgPrice = new Map<number, { price: number | null; currency: string | null }>();
  if (pkgIds.length) {
    const { data: rows } = await db.from('venue_packages')
      .select('id, price, price_per_person, currency').in('id', pkgIds);
    /* price is the whole-package figure where a venue set one; otherwise
       per person, which the quantity below multiplies. */
    for (const r of rows ?? []) {
      pkgPrice.set(r.id, { price: r.price ?? r.price_per_person, currency: r.currency });
    }
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

    /* ── the nights, re-checked ────────────────────────────────────
       A time booked by the hour is already asked of free_slots again
       further down; a week was not asked of anything. The cart is the
       guest's own browser storage and it may have sat there for days,
       so the dates are checked against the venue's calendar here —
       before the order exists, so a clash costs nothing but a message.

       Named rather than vague: "those dates have gone" sends somebody
       back to a page with nothing to act on. */
    if (isStay && slice.from) {
      const clashes = await stayClashes(
        { id: vid, name: slice.venueName }, slice.from, slice.to ?? '');
      if (clashes.length) {
        const taken = clashes.some((c) => c.reason === 'Taken');
        const shut = clashes.some((c) => c.reason === 'Closed');
        return {
          ok: false,
          error: `${slice.venueName}: ${clashes[0].date}`
               + (clashes.length > 1 ? ` and ${clashes.length - 1} other night`
                   + `${clashes.length > 2 ? 's' : ''}` : '')
               + (taken && shut ? ' are no longer available.'
                   : taken ? ` ${clashes.length > 1 ? 'have' : 'has'} been taken since you chose them.`
                   : ' the venue is closed. Please choose other dates.'),
        };
      }
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
  /* Every booking this checkout wrote, in the order it wrote them, so each
     can be placed once the whole order is down. */
  const madeBookingIds: number[] = [];

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
      const priced = it.kind === 'svclen' ? lenPrice.get(it.id)
        : it.kind === 'space' ? spacePrice.get(it.id)
        : it.kind === 'package' ? pkgPrice.get(it.id)
        : (it.kind === 'exp' || it.kind === 'extra') ? priceMap.get(it.id) : undefined;
      const unit = priced && priced.price != null ? Number(priced.price) : null; // rooms/buyout: null (no rates yet)
      const lineTotal = unit != null ? unit * qty : null;
      if (lineTotal != null) bookingSubtotal += lineTotal;

      /* ── the booked time, re-checked ───────────────────────────────
         A service booked by time carries its own date and clock time,
         which the venue reads instead of "Morning". The cart said so, and
         the cart is the guest's own browser storage — so the time is
         asked of free_slots again here before it is filed. A time that is
         no longer offered (somebody else took it, the venue closed the
         day, the party grew past the capacity) is dropped to a date-only
         request rather than booked anyway. */
      let timing: Record<string, unknown> = {};
      if (it.kind === 'exp' && it.slotDate && it.startsLocal) {
        const { data: free } = await db.rpc('free_slots', {
          p_venue_id: venueId,
          p_service_id: it.id,
          p_from: it.slotDate,
          p_to: it.slotDate,
          p_people: qty,
        });
        const match = (free as any[] | null)?.find(
          (s) => String(s.on_date) === it.slotDate
              && String(s.starts_local).slice(0, 5) === it.startsLocal);
        if (match) {
          timing = {
            date_from: it.slotDate, date_to: it.slotDate,
            start_time: String(match.starts_local).slice(0, 8),
            end_time: String(match.ends_local).slice(0, 8),
            scheduled_at: new Date(match.starts_utc).toISOString(),
            session_slot_id: match.slot_id ?? null,
            person_count: qty,
          };
        }
      }

      lineRows.push({
        item_type: ITEM_TYPE[it.kind] ?? 'Add-on',
        item_id: it.id, label: it.label ?? null,
        quantity: qty, unit_price: unit, line_total: lineTotal,
        date_from: slice.from || null, date_to: slice.to || null,
        item_status: 'Requested', currency,
        ...timing,
      });
    }

    /* ── discounts ──────────────────────────────────────────────────
       Worked out by the database, not here. quote_discounts owns the
       rules — exclusivity, conditions, the cap at the basket total — and
       commission comes off the discounted price, so a second
       implementation in this file would be a second answer to what TGS
       earned.

       Only the priced lines are sent: a room with no rate yet has a null
       unit price and would make a nonsense of a percentage. */
    let discountTotal = 0;
    const discountNames: string[] = [];
    const discountLines: any[] = [];

    const pricedLines = lineRows
      .filter((l) => l.unit_price != null && l.item_type !== 'Discount')
      .map((l) => ({
        item_type: l.item_type, item_id: l.item_id,
        unit_price: Number(l.unit_price), quantity: l.quantity,
      }));

    if (pricedLines.length) {
      const { data: offers, error: offerErr } = await db.rpc('quote_discounts', {
        p_venue_id: venueId,
        p_lines: pricedLines,
        p_people: slice.guests ? Number(slice.guests) : null,
        p_code: (cart as any)?.discountCode?.trim?.() || null,
      });

      /* A failure here must not silently charge full price on a booking
         the guest was shown a discount for. It is recorded on the booking
         so somebody can see it happened. */
      if (offerErr) {
        discountNames.push(`Discounts could not be applied: ${offerErr.message}`);
      } else {
        for (const o of (offers ?? []) as any[]) {
          if (!o.applied || Number(o.saving) <= 0) continue;
          const saving = Math.round(Number(o.saving) * 100) / 100;
          discountTotal += saving;
          discountNames.push(o.title);
          discountLines.push({
            item_type: 'Discount',
            item_id: o.discount_id,
            label: o.title,
            quantity: 1,
            /* Negative, so a subtotal built by summing the lines agrees
               with the subtotal recorded on the booking. */
            unit_price: -saving,
            line_total: -saving,
            date_from: slice.from || null, date_to: slice.to || null,
            item_status: 'Requested', currency,
          });
        }
      }
    }

    discountTotal = Math.min(Math.round(discountTotal * 100) / 100, bookingSubtotal);
    const chargeable = Math.round((bookingSubtotal - discountTotal) * 100) / 100;
    lineRows.push(...discountLines);

    /* Commission on what the guest paid, by decision.
       NOT computed here, despite appearances. apply_commission on bookings
       overwrites commission_amount on every write from rate x basis, so
       anything this file calculates is discarded. The way to make
       commission follow the discount is to discount the subtotal itself:
       every basis — Subtotal, Total, Accommodation only — then computes
       off the discounted figure, and the handling of tourism tax and card
       fees is untouched. Setting commission_basis to 'Total' instead would
       also have stopped those being deducted, which is a different change
       nobody asked for.
       The gross is still recoverable: it is the sum of the non-Discount
       lines, which is the reason the discount is its own line. */
    const commissionAmount = Math.round(chargeable * (commissionRate / 100) * 100) / 100;

    /* A booking of nothing but wellness services had no dates at all: the
       slice's from/to belong to a stay, and a guest booking a single
       massage never sets them. So the booking was filed with date_from
       null, which is unreportable and unanswerable — the venue could not
       be asked to confirm a date nobody had recorded. Where the lines
       carry their own booked dates, the booking spans them. */
    const lineDates = lineRows
      .map((l) => l.date_from)
      .filter((d): d is string => typeof d === 'string' && !!d)
      .sort();
    const bookingFrom = slice.from || lineDates[0] || null;
    const bookingTo = slice.to || lineDates[lineDates.length - 1] || null;

    const { data: booking, error: bErr } = await db.from('bookings').insert({
      order_id: order.id, venue_id: venueId,
      booked_by_type: 'Wellness Guest', status: 'Pending',
      created_by_type: 'Guest self-serve', created_via: 'Booked on the site',
      date_from: bookingFrom, date_to: bookingTo,
      guest_count: slice.guests ? Number(slice.guests) : null,
      guest_name: name, guest_email: linkEmail, guest_phone: contact?.phone?.trim() || null,
      wellness_guest_id: wellnessGuestId,
      cancellation_policy_id: policyId,
      commission_rate: commissionRate, commission_amount: commissionAmount,
      /* Net of discounts. A retail subtotal is after discounts, and this
         is what commission is taken on. */
      subtotal: chargeable, total: chargeable, currency, is_primary_booking: true,
      discount_amount: discountTotal > 0 ? discountTotal : null,
      discount_rate: discountTotal > 0 && bookingSubtotal > 0
        ? Math.round((discountTotal / bookingSubtotal) * 10000) / 100 : null,
      discount_reason: discountNames.length ? discountNames.join(' · ') : null,
    }).select('id').single();
    if (bErr || !booking) return { ok: false, error: bErr?.message ?? 'Could not create a booking.' };

    if (lineRows.length) {
      const withBooking = lineRows.map((r) => ({ ...r, booking_id: booking.id }));
      const { error: liErr } = await db.from('booking_items').insert(withBooking);
      if (liErr) return { ok: false, error: liErr.message };
    }
    /* Placed once the lines are down, below. The venue's question is built
       out of these rows, so asking before they existed would show a venue
       an empty booking. */
    madeBookingIds.push(booking.id as number);
    /* What the order is worth, which is what will be charged. */
    orderSubtotal += chargeable;
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
      /* The same contexts the checkout screen used, worked out the same way,
         so what is recorded is exactly what was shown. */
      fetchTgsAcceptanceDocs(db as never, contextsFromBooking(venues.map(([, v]) => v as any))),
      fetchVenueAcceptanceDocs(db as never, bookedVenueIds),
    ]);

    if (tgsDocs.length || venueDocs.length) {
      const h = await headers();
      const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
      const ua = h.get('user-agent') ?? null;
      /* What the panel recorded them doing, where one was shown. Trimmed
         and capped on the way in: these are stored verbatim as evidence,
         so an unbounded string from a browser does not belong in them. */
      const sig = agreement
        ? {
          sections_read: Array.isArray(agreement.sectionsRead)
            ? agreement.sectionsRead.slice(0, 50).map((s) => String(s).slice(0, 200))
            : null,
          typed_affirmation: agreement.typedAffirmation
            ? String(agreement.typedAffirmation).slice(0, 200) : null,
          signature_kind: agreement.signatureKind === 'drawn'
            || agreement.signatureKind === 'typed' ? agreement.signatureKind : null,
          signature_name: agreement.signatureName
            ? String(agreement.signatureName).slice(0, 200) : null,
          /* A drawn signature is a PNG data URL. Capped well above what a
             signature pad produces and well below what would bloat a row. */
          signature_image: agreement.signatureImage
            && String(agreement.signatureImage).startsWith('data:image/png;base64,')
            && String(agreement.signatureImage).length <= 400_000
            ? String(agreement.signatureImage) : null,
        }
        : {};

      const base = {
        order_id: order.id,
        signatory_name: name,
        signatory_email: linkEmail,
        party_type: 'Wellness Guest',
        source: 'Checkout',
        ip_address: ip,
        user_agent: ua,
        ...sig,
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
            ...sig,
          })),
        );
      }

      /* The signer's copy, once both registers have been written. Last,
         and non-fatal: a booking that exists without its receipt is
         recoverable, and a booking lost because an email failed is not.
         The portal reads the rows back rather than being told what they
         say, so this cannot confirm an acceptance that was not recorded. */
      try {
        await sendSignedCopy({
          orderId: order.id,
          to: linkEmail,
          reference,
          firstName: (name ?? '').split(' ')[0] ?? '',
        });
      } catch (e) {
        console.error('[submitBooking] the signed copy did not go', e);
      }
    }
  } catch { /* never fail a booking over the audit trail */ }

  /* ═════════════════════════════════════════════════════════════════════
     PUTTING THE BOOKING IN FRONT OF THE VENUE

     Until this existed, checkout wrote the booking at 'Pending' and
     stopped. Nothing here referenced place_booking, send_booking_request,
     venue_books_instantly or booking_requests, so a real guest never
     entered the confirmation flow at all: no token reached the venue, no
     dates were held, the payout ladder was never built, and the
     confirmation emails could not fire because nothing called the function
     that queues them. Every booking taken on the site waited for somebody
     to notice it and place it by hand in the portal.

     place_booking decides which way each one goes. A venue that has turned
     instant booking on, turned owner approval off and connected a calendar
     gets told; everybody else gets asked. While there is no payment on this
     site, its money guard sends every booking with a balance down the asked
     route whatever the venue's settings say — which is the behaviour we
     want until Stripe is wired, not a thing to work around.

     One booking per venue, so a guest who booked three venues at once
     produces three requests and each venue sees only its own.

     Non-fatal, like the audit trail and the emails below. The booking and
     its lines are already written; a guest must not see a failure for
     something that already happened. A booking left at 'Pending' is
     visible in the portal and can be placed by hand, which is exactly
     where every booking sat before this ran at all.
     ═════════════════════════════════════════════════════════════════════ */
  for (const bookingId of madeBookingIds) {
    try {
      const { data: placed, error: placeErr } = await db
        .rpc('place_booking', { p_booking_id: bookingId });

      if (placeErr) {
        console.error('[submitBooking] place_booking failed', bookingId, placeErr.message);
        continue;
      }

      const p = (placed ?? {}) as Record<string, unknown>;
      if (!p.ok) {
        /* A refusal with a reason, not a crash — "no booking settings on
           this venue yet", "those dates are already held". Worth the log
           line, because it is the difference between a venue that was
           never asked and one that could not be. */
        console.error('[submitBooking] not placed', bookingId, p.why);
        continue;
      }

      /* Confirmed outright. answer_booking_request has already frozen the
         terms, built the payout ladder and queued the guest's
         confirmation, the venue's copy and the guest's text, so the
         notification runner takes it from here and there is nothing to
         ask. */
      if (p.path === 'Instant') continue;

      /* Asked. place_booking hands back the token it minted and the
         address send_booking_request resolved; the portal builds and sends
         the question. No token means the request was already open from an
         earlier attempt, and asking twice is worse than not asking. */
      if (p.token && p.to) {
        await askVenueToConfirm({
          requestId: Number(p.request_id),
          token: String(p.token),
          to: String(p.to),
        });
      }
    } catch (e) {
      console.error('[submitBooking] placing threw', bookingId, e);
    }
  }

  /* Tell the guest, and tell us.
   *
   * Both go through the portal, so they are templates that can be edited
   * rather than copy living in this file, and both land in sent_emails with
   * the version recorded.
   *
   * After the booking is written, never before. If the portal is unreachable
   * that means an email that did not arrive, not a booking that did not
   * happen. */
  const venueList = venues.map(([, v]) => v.venueName).filter(Boolean).join(', ');

  if (linkEmail) {
    notify({
      slug: 'booking-request-received',
      to: linkEmail,
      subjectId: order.id,
      extra: { order_reference: reference, venue_list: venueList },
    });
  }

  notify({
    slug: 'internal-booking-request',
    to: INTERNAL,
    subjectId: order.id,
    extra: { order_reference: reference, venue_list: venueList,
             guest_name: name, guest_email: linkEmail,
             guest_phone: contact?.phone?.trim() ?? '' },
  });

  return { ok: true, orderReference: reference };
}
