'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trackCartEvent } from '@/lib/track';

/* Experience booking control.
 *
 * No live availability or instant book exists yet (0 published slots), and
 * payments are gated, so this is request-to-book: the guest states a date, a
 * time of day and party size, and adds it to their booking. It lands in the
 * holistic cart under the experience's VENUE — so an experience sits beside any
 * rooms from that venue — and the request is submitted at checkout. When a
 * venue later publishes real sessions, this control gains a live slot picker;
 * the cart shape does not change. */

type Props = {
  id: number; name: string;
  basePrice: number | null; currency: string | null; durationMinutes: number | null;
  maxParticipants: number | null;
  venueName: string | null; venueId: number | null; listingSlug: string | null; marketplace: string | null;
  image: string | null; place: string | null;
};

const TIMES = ['Morning', 'Midday', 'Afternoon', 'Evening'];

function fmtDate(s: string) { try { return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s; } }

export default function ExperienceBooking(p: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('Morning');
  const [ppl, setPpl] = useState(1);
  const [added, setAdded] = useState(false);

  const max = p.maxParticipants && p.maxParticipants > 0 ? p.maxParticipants : 20;
  const unit = p.basePrice ?? null;
  const total = unit != null ? unit * ppl : null;
  const money = (v: number | null) => (v == null ? null : new Intl.NumberFormat('en-AU', { style: 'currency', currency: p.currency || 'AUD', maximumFractionDigits: 0 }).format(v));

  const venueKey = p.marketplace && p.listingSlug ? `/${p.marketplace}/${p.listingSlug}` : '/experiences';

  const add = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('tgs_cart') || '{}');
      if (!cart.venues) cart.venues = {};
      const slice = cart.venues[venueKey] ?? {
        venueName: p.venueName ?? "", location: p.place ?? '', currency: p.currency ?? 'AUD',
        venueImage: p.image ?? null, from: '', to: '', guests: String(ppl), buyout: false,
        cancellation: null, freeCancelDays: null, backHref: venueKey, items: [], total: 0,
      };
      const detail = [date ? fmtDate(date) : 'Date to confirm', time, `${ppl} ${ppl > 1 ? 'guests' : 'guest'}`].filter(Boolean).join(' · ');
      const itemKey = `exp-${p.id}-${date}-${time}`;
      const existing = slice.items.find((it: any) => it.key === itemKey);
      if (existing) { existing.qty = ppl; existing.amount = unit != null ? unit * ppl : null; existing.detail = detail; }
      else slice.items.push({
        key: itemKey, kind: 'exp', id: p.id, label: p.name, detail,
        qty: ppl, max, amount: unit != null ? unit * ppl : null, unit,
        image: p.image ?? null, eyebrow: 'Wellness experience', qtyLabel: 'Guests',
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
          <div className="xb-done-sub">{p.name} · {[date ? fmtDate(date) : 'date to confirm', time, `${ppl} ${ppl > 1 ? 'guests' : 'guest'}`].join(' · ')}</div>
        </div>
        <Link href="/booking" className="xb-btn xb-btn-primary">Review booking</Link>
        <button type="button" className="xb-btn xb-btn-ghost" onClick={() => setAdded(false)}>Add another time</button>
      </div>
    );
  }

  return (
    <div className="xb">
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
      <div className="xb-field">
        <span className="xb-label">Guests</span>
        <div className="xb-stepper">
          <button type="button" onClick={() => setPpl((n) => Math.max(1, n - 1))} disabled={ppl <= 1} aria-label="Fewer">&minus;</button>
          <span>{ppl}</span>
          <button type="button" onClick={() => setPpl((n) => Math.min(max, n + 1))} disabled={ppl >= max} aria-label="More">+</button>
        </div>
      </div>

      {total != null && (
        <div className="xb-total"><span>Estimated total</span><span className="xb-total-amt">{money(total)}</span></div>
      )}

      <button type="button" className="xb-btn xb-btn-primary" onClick={add}>Add to booking</button>
      <p className="xb-note">You won&rsquo;t be charged now. Add what you&rsquo;d like, then send it as a booking request; the venue confirms your time.</p>
    </div>
  );
}
