'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trackCartEvent } from '@/lib/track';
import SlotPicker, { type Chosen } from './SlotPicker';

/* Experience booking control.
 *
 * Two shapes, decided by whether the venue has real availability to show.
 *
 * Where it does — the venue has a timezone, opening hours and a service
 * with a duration — the guest picks an actual date and an actual time from
 * free_slots, in the venue's own clock with their own time beneath it.
 *
 * Where it does not, this falls back to what it has always been:
 * request-to-book, a preferred date and a time of day, with the venue
 * working out the rest. That is still most venues, and a guest who cannot
 * see a time must still be able to ask for one.
 *
 * Either way it lands in the holistic cart under the experience's VENUE —
 * so an experience sits beside any rooms from that venue — and the request
 * is submitted at checkout. Payments are gated, so nothing is charged
 * here; the venue confirms first. */

type Props = {
  id: number; name: string;
  basePrice: number | null; currency: string | null; durationMinutes: number | null;
  maxParticipants: number | null;
  venueName: string | null; venueId: number | null; listingSlug: string | null; marketplace: string | null;
  image: string | null; place: string | null;
  /** How it is taken: a scheduled class, a private appointment, open
   *  access or a multi-day programme. Null reads as an appointment,
   *  which is what everything was before formats existed. */
  bookingFormat?: string | null;
};

const TIMES = ['Morning', 'Midday', 'Afternoon', 'Evening'];

function fmtDate(s: string) { try { return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s; } }

/* The venue's own calendar day, assembled from the parts rather than read
   through the browser's zone — which would put a Saturday session in
   Australia on the Friday for a guest in Canada. */
function fmtVenueDate(iso: string) {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
  } catch { return iso; }
}

const zoneName = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;

export default function ExperienceBooking(p: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('Morning');
  const [ppl, setPpl] = useState(1);
  const [added, setAdded] = useState(false);
  /* Null until the picker reports back. Starting at "no live availability"
     would flash the fallback control on every page load. */
  const [live, setLive] = useState<boolean | null>(p.venueId ? null : false);
  const [slot, setSlot] = useState<Chosen | null>(null);

  const max = p.maxParticipants && p.maxParticipants > 0 ? p.maxParticipants : 20;
  const unit = p.basePrice ?? null;
  const total = unit != null ? unit * ppl : null;
  const money = (v: number | null) => (v == null ? null : new Intl.NumberFormat('en-AU', { style: 'currency', currency: p.currency || 'AUD', maximumFractionDigits: 0 }).format(v));

  const venueKey = p.marketplace && p.listingSlug ? `/${p.marketplace}/${p.listingSlug}` : '/experiences';

  /* A class is taken in places, a treatment by guests. The same number
     either way — but "2 places" is what a guest booking into a six
     o'clock yoga class expects to see on the cart line. */
  const scheduled = p.bookingFormat === 'Scheduled session';
  const headCount = (n: number) => scheduled
    ? `${n} place${n > 1 ? 's' : ''}`
    : `${n} ${n > 1 ? 'guests' : 'guest'}`;

  /* What the guest has settled on, in the one shape the cart and the
     confirmation panel both read. A session carries its finish time —
     a class is an hour and a quarter of somebody's evening, and that
     is the part they are deciding about. */
  const chosenDetail = slot
    ? [fmtVenueDate(slot.date),
       `${slot.startsLocal}${scheduled && slot.endsLocal ? `–${slot.endsLocal}` : ''}`
         + ` ${zoneName(slot.tz)} time`,
       headCount(ppl)].join(' · ')
    : [date ? fmtDate(date) : 'Date to confirm', time, headCount(ppl)]
        .filter(Boolean).join(' · ');

  const canAdd = slot != null || live === false;

  const add = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('tgs_cart') || '{}');
      if (!cart.venues) cart.venues = {};
      const slice = cart.venues[venueKey] ?? {
        venueName: p.venueName ?? "", location: p.place ?? '', currency: p.currency ?? 'AUD',
        venueImage: p.image ?? null, from: '', to: '', guests: String(ppl), buyout: false,
        cancellation: null, freeCancelDays: null, backHref: venueKey, items: [], total: 0,
      };
      const detail = chosenDetail;
      const itemKey = slot
        ? `exp-${p.id}-${slot.date}-${slot.startsLocal}`
        : `exp-${p.id}-${date}-${time}`;
      /* The booked time travels with the line so checkout can file it on
         booking_items — start_time, end_time and the instant — instead of
         the venue reading "Morning" in an email and guessing. */
      const timing = slot ? {
        slotDate: slot.date, startsLocal: slot.startsLocal, endsLocal: slot.endsLocal,
        startsUtc: slot.startsUtc, slotTz: slot.tz, slotId: slot.slotId,
        bookingFormat: p.bookingFormat ?? null,
      } : { bookingFormat: p.bookingFormat ?? null };
      const existing = slice.items.find((it: any) => it.key === itemKey);
      if (existing) {
        existing.qty = ppl;
        existing.amount = unit != null ? unit * ppl : null;
        existing.detail = detail;
        Object.assign(existing, timing);
      } else slice.items.push({
        key: itemKey, kind: 'exp', id: p.id, label: p.name, detail,
        qty: ppl, max, amount: unit != null ? unit * ppl : null, unit,
        image: p.image ?? null,
        eyebrow: scheduled ? 'Class or group session' : 'Wellness experience',
        qtyLabel: scheduled ? 'Places' : 'Guests',
        ...timing,
      });
      slice.total = slice.items.reduce((s: number, it: any) => s + (it.amount || 0), 0);
      cart.venues[venueKey] = slice; cart.savedAt = Date.now();
      localStorage.setItem('tgs_cart', JSON.stringify(cart));
      trackCartEvent({ eventType: 'add', venueId: p.venueId, itemType: 'exp', itemId: p.id, quantity: ppl, unitPrice: unit, currency: p.currency });
      setAdded(true);
    } catch { /* never break the page */ }
  };

  if (added) {
    return (
      <div className="xb">
        <div className="xb-done">
          <div className="xb-done-tick" aria-hidden="true">✓</div>
          <div className="xb-done-title">Added to your booking</div>
          <div className="xb-done-sub">{p.name} · {chosenDetail}</div>
        </div>
        <Link href="/booking" className="xb-btn xb-btn-primary">Review booking</Link>
        <button type="button" className="xb-btn xb-btn-ghost"
          onClick={() => { setAdded(false); setSlot(null); }}>Add another time</button>
      </div>
    );
  }

  return (
    <div className="xb">
      {p.venueId != null && live !== false && (
        <SlotPicker
          venueId={p.venueId}
          serviceId={p.id}
          people={ppl}
          value={slot}
          onChange={(c) => { setSlot(c); setLive(true); }}
          onUnavailable={() => setLive(false)}
          format={p.bookingFormat ?? null}
        />
      )}

      {/* The old control, for a venue with nothing published yet. */}
      {live === false && (
        <>
          <label className="xb-field">
            <span className="xb-label">Preferred date</span>
            <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="xb-input" />
          </label>
          <label className="xb-field">
            <span className="xb-label">Time of day</span>
            <select value={time} onChange={(e) => setTime(e.target.value)} className="xb-input">
              {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </>
      )}

      <div className="xb-field">
        <span className="xb-label">{scheduled ? 'Places' : 'Guests'}</span>
        <div className="xb-stepper">
          <button type="button" onClick={() => setPpl((n) => Math.max(1, n - 1))} disabled={ppl <= 1} aria-label="Fewer">&minus;</button>
          <span>{ppl}</span>
          <button type="button" onClick={() => setPpl((n) => Math.min(max, n + 1))} disabled={ppl >= max} aria-label="More">+</button>
        </div>
      </div>

      {total != null && (
        <div className="xb-total"><span>Estimated total</span><span className="xb-total-amt">{money(total)}</span></div>
      )}

      {/* The button says why it cannot be pressed. */}
      <button type="button" className="xb-btn xb-btn-primary" onClick={add} disabled={!canAdd}>
        {canAdd ? 'Add to booking'
          : live === null ? 'Checking availability'
            : scheduled ? 'Choose a session' : 'Choose a time'}
      </button>
      <p className="xb-note">
        {live === false
          ? <>You won&rsquo;t be charged now. Add what you&rsquo;d like, then send it as a booking request; the venue confirms your time.</>
          : <>You won&rsquo;t be charged now. The venue confirms the time before any payment is taken.</>}
      </p>
    </div>
  );
}
