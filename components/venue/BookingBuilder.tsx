'use client';

import { useMemo, useState } from 'react';

/* Build a booking.
 *
 * The guest assembles a stay: room types with quantities, experiences and
 * extras, with a running total. Pricing here is a client-side estimate off
 * the venue's rate plans and prices — an honest preview. The authoritative
 * figure (seasonal overlays, discounts, deposit) is settled server-side at
 * checkout, which is a later stage. Rooms are priced by their own rate plan
 * (applies_to Room Type / Room), so a venue prices by the room, exactly as
 * intended. */

type Any = Record<string, any>;

function money(amount: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: currency || 'AUD', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || 'AUD'} ${Math.round(amount)}`;
  }
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="bb-stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Fewer">&minus;</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More">+</button>
    </div>
  );
}

export default function BookingBuilder({
  rooms = [], services = [], extras = [], ratePlans = [], currency = 'AUD',
}: {
  rooms?: Any[]; services?: Any[]; extras?: Any[]; ratePlans?: Any[]; currency?: string | null;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [guests, setGuests] = useState('2');
  const [roomQty, setRoomQty] = useState<Record<number, number>>({});
  const [expQty, setExpQty] = useState<Record<number, number>>({});
  const [extraQty, setExtraQty] = useState<Record<number, number>>({});

  const nights = useMemo(() => {
    if (!from || !to || to <= from) return 0;
    return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  }, [from, to]);
  const guestN = Math.max(1, Number(guests) || 1);

  const roomPlan = (roomId: number) =>
    ratePlans.find((rp) => (rp.applies_to === 'Room Type' || rp.applies_to === 'Room') && rp.target_id === roomId);

  const priceByBasis = (base: number, basis: string | null, persons: number): number => {
    switch (basis) {
      case 'Per Night':
      case 'Per Day':
      case 'Per Group Per Night': return base * nights;
      case 'Per Person Per Night': return base * nights * persons;
      case 'Per Person': return base * persons;
      case 'Per Package':
      case 'Per Session': return base;
      default: return base * (nights || 1);
    }
  };

  const extraByBasis = (base: number, basis: string | null): number => {
    switch ((basis || '').toLowerCase()) {
      case 'per person': return base * guestN;
      case 'per night': return base * (nights || 1);
      case 'per person per night': return base * guestN * (nights || 1);
      default: return base;
    }
  };

  const lines = useMemo(() => {
    const out: { key: string; label: string; detail: string; amount: number | null; qty: number }[] = [];
    for (const r of rooms) {
      const q = roomQty[r.id] ?? 0;
      if (!q) continue;
      const rp = roomPlan(r.id);
      const amount = rp && rp.base_price != null && nights
        ? priceByBasis(Number(rp.base_price), rp.pricing_basis, r.sleeps || 1) * q
        : null;
      out.push({ key: `room-${r.id}`, label: `${r.name} × ${q}`, detail: nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Add dates', amount, qty: q });
    }
    for (const s of services) {
      const q = expQty[s.id] ?? 0;
      if (!q) continue;
      const amount = s.base_price != null ? Number(s.base_price) * q : null;
      out.push({ key: `exp-${s.id}`, label: `${s.name} × ${q}`, detail: 'Experience', amount, qty: q });
    }
    for (const e of extras) {
      const q = extraQty[e.id] ?? 0;
      if (!q) continue;
      const amount = e.price != null ? extraByBasis(Number(e.price), e.price_basis) * q : null;
      out.push({ key: `extra-${e.id}`, label: `${e.name} × ${q}`, detail: e.extra_category || 'Extra', amount, qty: q });
    }
    return out;
  }, [rooms, services, extras, ratePlans, roomQty, expQty, extraQty, nights, guestN]);

  const total = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const anySelected = lines.length > 0;
  const anyUnpriced = lines.some((l) => l.amount == null);

  return (
    <div className="bb">
      <div className="bb-choices">
        <div className="bb-dates">
          <label className="bb-field"><span>Arrival</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="bb-field"><span>Departure</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="bb-field"><span>Guests</span><input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} /></label>
        </div>

        {rooms.length > 0 && (
          <section className="bb-section">
            <h3>Accommodation</h3>
            {rooms.map((r) => {
              const rp = roomPlan(r.id);
              const per = rp && rp.base_price != null ? priceByBasis(Number(rp.base_price), rp.pricing_basis, r.sleeps || 1) : null;
              return (
                <div key={r.id} className="bb-row">
                  <div className="bb-row-main">
                    <span className="bb-row-name">{r.name}</span>
                    <span className="bb-row-detail">
                      {[r.bed_configuration, r.bathroom_type, r.sleeps ? `sleeps ${r.sleeps}` : null].filter(Boolean).join(' · ')}
                    </span>
                    <span className="bb-row-price">
                      {per != null && nights ? `${money(per, currency)} for the stay` : rp ? 'Add dates' : 'Price on request'}
                    </span>
                  </div>
                  <Stepper value={roomQty[r.id] ?? 0} min={0} max={r.quantity ?? 9}
                    onChange={(n) => setRoomQty({ ...roomQty, [r.id]: n })} />
                </div>
              );
            })}
          </section>
        )}

        {services.length > 0 && (
          <section className="bb-section">
            <h3>Experiences</h3>
            {services.map((s) => (
              <div key={s.id} className="bb-row">
                <div className="bb-row-main">
                  <span className="bb-row-name">{s.name}</span>
                  <span className="bb-row-detail">{[s.duration_minutes ? `${s.duration_minutes} min` : null, s.category].filter(Boolean).join(' · ')}</span>
                  <span className="bb-row-price">{s.base_price != null ? `${s.price_is_from ? 'from ' : ''}${money(Number(s.base_price), currency)}` : 'Price on request'}</span>
                </div>
                <Stepper value={expQty[s.id] ?? 0} min={0} max={20} onChange={(n) => setExpQty({ ...expQty, [s.id]: n })} />
              </div>
            ))}
          </section>
        )}

        {extras.length > 0 && (
          <section className="bb-section">
            <h3>Extras</h3>
            {extras.map((e) => (
              <div key={e.id} className="bb-row">
                <div className="bb-row-main">
                  <span className="bb-row-name">{e.name}</span>
                  <span className="bb-row-detail">{[e.extra_category, e.price_basis].filter(Boolean).join(' · ')}</span>
                  <span className="bb-row-price">{e.price != null ? money(Number(e.price), currency) : 'Price on request'}</span>
                </div>
                <Stepper value={extraQty[e.id] ?? 0} min={0} max={e.maximum_quantity ?? 20}
                  onChange={(n) => setExtraQty({ ...extraQty, [e.id]: n })} />
              </div>
            ))}
          </section>
        )}
      </div>

      <aside className="bb-cart">
        <div className="bb-cart-inner">
          <h3>Your booking</h3>
          {!anySelected && <p className="bb-empty">Nothing added yet. Choose rooms, experiences or extras.</p>}
          {anySelected && (
            <>
              <ul className="bb-cart-lines">
                {lines.map((l) => (
                  <li key={l.key}>
                    <span className="bb-cart-what"><span>{l.label}</span><span className="bb-cart-sub">{l.detail}</span></span>
                    <span className="bb-cart-amt">{l.amount != null ? money(l.amount, currency) : '—'}</span>
                  </li>
                ))}
              </ul>
              <div className="bb-cart-total">
                <span>Estimated total</span>
                <span>{money(total, currency)}</span>
              </div>
              {anyUnpriced && <p className="bb-note">Some items are priced on request and are not in this estimate.</p>}
              <button type="button" className="bb-request" disabled>Request to book</button>
              <p className="bb-note">An estimate. The final quote, deposit and payment schedule are confirmed when you request to book.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
