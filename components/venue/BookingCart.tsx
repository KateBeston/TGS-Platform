'use client';

import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

/* The booking drawer.
 *
 * A shared cart the whole venue page can write to. It lives in a slide-in
 * drawer with three states — minimised (a quiet pill), open, and maximised
 * (wider) — and on desktop the page reflows to make room while it's open,
 * animating rather than jumping. On mobile the drawer is a full overlay and
 * the page never moves. Add-to-cart controls on the cards feed the same cart.
 *
 * Pricing here is a client-side estimate off the rate plans and prices; the
 * authoritative figure is settled server-side at checkout, a later stage. */

type Any = Record<string, any>;
type Drawer = 'min' | 'open' | 'max';
type Kind = 'room' | 'exp' | 'extra';

type CartValue = {
  from: string; to: string; guests: string;
  setFrom: (s: string) => void; setTo: (s: string) => void; setGuests: (s: string) => void;
  qty: (kind: Kind, id: number) => number;
  setQty: (kind: Kind, id: number, n: number) => void;
  add: (kind: Kind, id: number) => void;
  clear: () => void;
  count: number;
  drawer: Drawer; setDrawer: (d: Drawer) => void;
};

const CartCtx = createContext<CartValue | null>(null);
export function useCart(): CartValue | null { return useContext(CartCtx); }

function money(amount: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: currency || 'AUD', maximumFractionDigits: 0 }).format(amount);
  } catch { return `${currency || 'AUD'} ${Math.round(amount)}`; }
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

/* Add-to-cart control for a card. Renders nothing outside a cart provider. */
export function AddToCart({ kind, id, max = 9 }: { kind: Kind; id: number; max?: number }) {
  const cart = useCart();
  if (!cart) return null;
  const n = cart.qty(kind, id);
  if (n === 0) {
    return <button type="button" className="bc-add" onClick={() => cart.add(kind, id)}>Add to booking</button>;
  }
  return <Stepper value={n} min={0} max={max} onChange={(v) => cart.setQty(kind, id, v)} />;
}

export function BookingCart({
  rooms = [], services = [], extras = [], ratePlans = [], currency = 'AUD', venueName = '', location = '', children,
}: {
  rooms?: Any[]; services?: Any[]; extras?: Any[]; ratePlans?: Any[]; currency?: string | null;
  venueName?: string; location?: string; children: ReactNode;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [guests, setGuests] = useState('2');
  const [roomQty, setRoomQty] = useState<Record<number, number>>({});
  const [expQty, setExpQty] = useState<Record<number, number>>({});
  const [extraQty, setExtraQty] = useState<Record<number, number>>({});
  const [drawer, setDrawer] = useState<Drawer>('min');

  const nights = useMemo(() => {
    if (!from || !to || to <= from) return 0;
    return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  }, [from, to]);
  const guestN = Math.max(1, Number(guests) || 1);

  const bag = (k: Kind) => (k === 'room' ? roomQty : k === 'exp' ? expQty : extraQty);
  const setBag = (k: Kind) => (k === 'room' ? setRoomQty : k === 'exp' ? setExpQty : setExtraQty);
  const qty = (k: Kind, id: number) => bag(k)[id] ?? 0;
  const setQty = (k: Kind, id: number, n: number) => setBag(k)({ ...bag(k), [id]: Math.max(0, n) });
  const add = (k: Kind, id: number) => { setQty(k, id, (bag(k)[id] ?? 0) + 1); setDrawer((d) => (d === 'min' ? 'open' : d)); };
  const clear = () => { setRoomQty({}); setExpQty({}); setExtraQty({}); };

  const roomPlan = (roomId: number) => ratePlans.find((rp) => (rp.applies_to === 'Room Type' || rp.applies_to === 'Room') && rp.target_id === roomId);
  const byBasis = (base: number, basis: string | null, persons: number): number => {
    switch (basis) {
      case 'Per Night': case 'Per Day': case 'Per Group Per Night': return base * nights;
      case 'Per Person Per Night': return base * nights * persons;
      case 'Per Person': return base * persons;
      case 'Per Package': case 'Per Session': return base;
      default: return base * (nights || 1);
    }
  };
  const extraBasis = (base: number, basis: string | null): number => {
    switch ((basis || '').toLowerCase()) {
      case 'per person': return base * guestN;
      case 'per night': return base * (nights || 1);
      case 'per person per night': return base * guestN * (nights || 1);
      default: return base;
    }
  };

  const lines = useMemo(() => {
    const out: { key: string; label: string; detail: string; amount: number | null; kind: Kind; id: number; qty: number; max: number }[] = [];
    for (const r of rooms) {
      const q = roomQty[r.id] ?? 0; if (!q) continue;
      const rp = roomPlan(r.id);
      const amount = rp && rp.base_price != null && nights ? byBasis(Number(rp.base_price), rp.pricing_basis, r.sleeps || 1) * q : null;
      out.push({ key: `room-${r.id}`, label: r.name, detail: nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Add dates', amount, kind: 'room', id: r.id, qty: q, max: r.quantity ?? 9 });
    }
    for (const s of services) {
      const q = expQty[s.id] ?? 0; if (!q) continue;
      const amount = s.base_price != null ? Number(s.base_price) * q : null;
      out.push({ key: `exp-${s.id}`, label: s.name, detail: 'Experience', amount, kind: 'exp', id: s.id, qty: q, max: 20 });
    }
    for (const e of extras) {
      const q = extraQty[e.id] ?? 0; if (!q) continue;
      const amount = e.price != null ? extraBasis(Number(e.price), e.price_basis) * q : null;
      out.push({ key: `extra-${e.id}`, label: e.name, detail: e.extra_category || 'Extra', amount, kind: 'extra', id: e.id, qty: q, max: e.maximum_quantity ?? 20 });
    }
    return out;
  }, [rooms, services, extras, ratePlans, roomQty, expQty, extraQty, nights, guestN]);

  const total = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const anyUnpriced = lines.some((l) => l.amount == null);

  const downloadQuote = async () => {
    const { downloadQuotePdf } = await import('./quotePdf');
    downloadQuotePdf({
      venueName, location, from, to, nights, guests: guestN,
      lines: lines.map((l) => ({ label: `${l.label} × ${l.qty}`, detail: l.detail, amount: l.amount })),
      total, currency: currency || 'AUD', anyUnpriced,
    });
  };

  const value: CartValue = { from, to, guests, setFrom, setTo, setGuests, qty, setQty, add, clear, count, drawer, setDrawer };

  return (
    <CartCtx.Provider value={value}>
      <div className={`bc-wrap bc-${drawer}`}>{children}</div>

      {/* Minimised: a quiet pill */}
      <button type="button" className="bc-pill" onClick={() => setDrawer('open')} aria-label="Open booking" hidden={drawer !== 'min'}>
        <span className="bc-pill-label">Booking</span>
        <span className="bc-pill-meta">{count > 0 ? `${count} · ${money(total, currency)}` : 'Start'}</span>
      </button>

      {/* Drawer */}
      <aside className={`bc-drawer bc-drawer-${drawer}`} aria-label="Your booking">
        <div className="bc-drawer-head">
          <span className="bc-drawer-title">Your booking</span>
          <div className="bc-drawer-controls">
            <button type="button" onClick={() => setDrawer(drawer === 'max' ? 'open' : 'max')} aria-label={drawer === 'max' ? 'Restore' : 'Maximise'}>
              {drawer === 'max' ? '⤡' : '⤢'}
            </button>
            <button type="button" onClick={() => setDrawer('min')} aria-label="Minimise">–</button>
          </div>
        </div>

        <div className="bc-drawer-body">
          <div className="bc-dates">
            <label className="bb-field"><span>Arrival</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="bb-field"><span>Departure</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="bb-field"><span>Guests</span><input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} /></label>
          </div>

          {extras.length > 0 && (
            <div className="bc-extras">
              <div className="bc-extras-label">Extras</div>
              {extras.map((e) => (
                <div key={e.id} className="bb-row">
                  <div className="bb-row-main">
                    <span className="bb-row-name">{e.name}</span>
                    <span className="bb-row-detail">{[e.extra_category, e.price_basis].filter(Boolean).join(' · ')}</span>
                    <span className="bb-row-price">{e.price != null ? money(Number(e.price), currency) : 'Price on request'}</span>
                  </div>
                  <Stepper value={extraQty[e.id] ?? 0} min={0} max={e.maximum_quantity ?? 20} onChange={(n) => setExtraQty({ ...extraQty, [e.id]: n })} />
                </div>
              ))}
            </div>
          )}

          {count === 0 && <p className="bb-empty">Nothing added yet. Choose rooms and experiences from the tabs, or extras above.</p>}
          {count > 0 && (
            <ul className="bc-lines">
              {lines.map((l) => (
                <li key={l.key} className="bc-line">
                  <span className="bc-line-what"><span>{l.label}</span><span className="bc-line-sub">{l.detail}</span></span>
                  <span className="bc-line-right">
                    <Stepper value={l.qty} min={0} max={l.max} onChange={(n) => setQty(l.kind, l.id, n)} />
                    <span className="bc-line-amt">{l.amount != null ? money(l.amount, currency) : '—'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bc-drawer-foot">
          <div className="bc-total"><span>Estimated total</span><span>{money(total, currency)}</span></div>
          {anyUnpriced && <p className="bb-note">Some items are priced on request and are not in this estimate.</p>}
          <div className="bc-actions">
            <button type="button" className="bb-btn bb-btn-quiet" onClick={clear} disabled={count === 0}>Clear</button>
            <button type="button" className="bb-btn bb-btn-quiet" onClick={downloadQuote} disabled={count === 0}>Download quote</button>
            <button type="button" className="bb-btn bb-btn-primary" disabled>Book</button>
          </div>
          <p className="bb-note">An estimate. The final quote, deposit and payment schedule are confirmed when you request to book.</p>
        </div>
      </aside>
    </CartCtx.Provider>
  );
}
