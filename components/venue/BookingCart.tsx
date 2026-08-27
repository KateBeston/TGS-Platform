'use client';

import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

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
  buyout: boolean;
};

const CartCtx = createContext<CartValue | null>(null);
export function useCart(): CartValue | null { return useContext(CartCtx); }

function money(amount: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: currency || 'AUD', maximumFractionDigits: 0 }).format(amount);
  } catch { return `${currency || 'AUD'} ${Math.round(amount)}`; }
}

const IcClock = () => <svg className="bc-fi" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const IcLock = () => <svg className="bc-fi" viewBox="0 0 24 24"><rect x="3" y="10" width="18" height="10" /><path d="M6 10V7a6 6 0 0112 0v3" /></svg>;
const IcShield = () => <svg className="bc-fi" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg>;
const IcBolt = () => <svg className="bc-fi" viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>;

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
  if (kind === 'room' && cart.buyout) return <span className="bc-included">Included in whole-venue buyout</span>;
  const n = cart.qty(kind, id);
  if (n === 0) {
    return <button type="button" className="bc-add" onClick={() => cart.add(kind, id)}>Add to booking</button>;
  }
  return <Stepper value={n} min={0} max={max} onChange={(v) => cart.setQty(kind, id, v)} />;
}

export function BookingCart({
  rooms = [], services = [], extras = [], ratePlans = [], currency = 'AUD', venueName = '', location = '', venueImage = null,
  allowBuyout = false, minStayNights = null, summary = null, confirmation = null, cancellation = null, children,
}: {
  rooms?: Any[]; services?: Any[]; extras?: Any[]; ratePlans?: Any[]; currency?: string | null;
  venueName?: string; location?: string; venueImage?: string | null; allowBuyout?: boolean; minStayNights?: number | null;
  summary?: string | null; confirmation?: string | null; cancellation?: string | null;
  children: ReactNode;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [guests, setGuests] = useState('2');
  const [roomQty, setRoomQty] = useState<Record<number, number>>({});
  const [expQty, setExpQty] = useState<Record<number, number>>({});
  const [extraQty, setExtraQty] = useState<Record<number, number>>({});
  const [drawer, setDrawer] = useState<Drawer>('min');
  const [buyout, setBuyout] = useState(false);
  const buyoutPlan = allowBuyout ? ratePlans.find((rp) => rp.applies_to === 'Whole Venue') : undefined;

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
  const clear = () => { setRoomQty({}); setExpQty({}); setExtraQty({}); setBuyout(false); };
  const selectBuyout = () => { setRoomQty({}); setBuyout(true); setDrawer((d) => (d === 'min' ? 'open' : d)); };

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

  const buyoutTotal = buyoutPlan && buyoutPlan.base_price != null && nights
    ? byBasis(Number(buyoutPlan.base_price), buyoutPlan.pricing_basis, guestN) : null;

  const roomEstimate = useMemo(() => {
    if (!nights) return null;
    const priced = rooms.map((r) => {
      const rp = roomPlan(r.id);
      return rp && rp.base_price != null
        ? { cost: byBasis(Number(rp.base_price), rp.pricing_basis, r.sleeps || 1), cap: Math.max(1, r.sleeps || 1), avail: r.quantity || 1 }
        : null;
    }).filter(Boolean) as { cost: number; cap: number; avail: number }[];
    if (!priced.length) return null;
    priced.sort((a, b) => a.cost / a.cap - b.cost / b.cap);
    let remaining = guestN, tot = 0;
    for (const p of priced) { let a = p.avail; while (remaining > 0 && a-- > 0) { tot += p.cost; remaining -= p.cap; } if (remaining <= 0) break; }
    return remaining <= 0 ? tot : null;
  }, [rooms, ratePlans, nights, guestN]);

  const bestValue: 'rooms' | 'buyout' | null =
    (roomEstimate != null && buyoutTotal != null) ? (buyoutTotal < roomEstimate ? 'buyout' : 'rooms') : null;

  const lines = useMemo(() => {
    type Line = { key: string; label: string; detail: string; amount: number | null; kind: Kind; id: number; qty: number; max: number; image: string | null; eyebrow: string; qtyLabel: string; unit: number | null };
    const out: Line[] = [];
    if (buyout && buyoutPlan) {
      out.push({ key: 'buyout', label: 'Whole venue — exclusive use', detail: nights ? `${nights} night${nights === 1 ? '' : 's'} · all rooms` : 'Add dates', amount: buyoutTotal, kind: 'room', id: -1, qty: 1, max: 1, image: venueImage, eyebrow: 'Whole venue', qtyLabel: '', unit: buyoutTotal });
    } else {
    for (const r of rooms) {
      const q = roomQty[r.id] ?? 0; if (!q) continue;
      const rp = roomPlan(r.id);
      const unit = rp && rp.base_price != null && nights ? byBasis(Number(rp.base_price), rp.pricing_basis, r.sleeps || 1) : null;
      out.push({ key: `room-${r.id}`, label: r.name, detail: [nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Add dates', r.bed_configuration, r.bathroom_type, r.sleeps ? `sleeps ${r.sleeps}` : null].filter(Boolean).join(' · '), amount: unit != null ? unit * q : null, kind: 'room', id: r.id, qty: q, max: r.quantity ?? 9, image: r.gallery_images?.[0] ?? venueImage, eyebrow: 'Accommodation', qtyLabel: 'Rooms', unit });
    }
    }
    for (const s of services) {
      const q = expQty[s.id] ?? 0; if (!q) continue;
      const unit = s.base_price != null ? Number(s.base_price) : null;
      out.push({ key: `exp-${s.id}`, label: s.name, detail: [s.duration_label, s.service_category].filter(Boolean).join(' · ') || 'Wellness service', amount: unit != null ? unit * q : null, kind: 'exp', id: s.id, qty: q, max: 20, image: s.gallery_images?.[0] ?? venueImage, eyebrow: 'Wellness service', qtyLabel: 'Guests', unit });
    }
    for (const e of extras) {
      const q = extraQty[e.id] ?? 0; if (!q) continue;
      const unit = e.price != null ? extraBasis(Number(e.price), e.price_basis) : null;
      out.push({ key: `extra-${e.id}`, label: e.name, detail: e.extra_category || 'Extra', amount: unit != null ? unit * q : null, kind: 'extra', id: e.id, qty: q, max: e.maximum_quantity ?? 20, image: e.gallery_images?.[0] ?? venueImage, eyebrow: 'Room extra', qtyLabel: 'Qty', unit });
    }
    return out;
  }, [rooms, services, extras, ratePlans, roomQty, expQty, extraQty, nights, guestN, buyout, buyoutTotal, buyoutPlan, venueImage]);

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

  const value: CartValue = { from, to, guests, setFrom, setTo, setGuests, qty, setQty, add, clear, count, drawer, setDrawer, buyout };

  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  // Restore this venue's slice from the global cart on mount.
  useEffect(() => {
    try {
      const key = window.location.pathname;
      const slice = JSON.parse(localStorage.getItem('tgs_cart') || '{}')?.venues?.[key];
      if (slice) {
        if (slice.from) setFrom(slice.from);
        if (slice.to) setTo(slice.to);
        if (slice.guests) setGuests(String(slice.guests));
        if (slice.buyout) setBuyout(true);
        const rq: Record<number, number> = {}, eq: Record<number, number> = {}, xq: Record<number, number> = {};
        for (const it of slice.items ?? []) {
          if (it.key === 'buyout' || it.id == null) continue;
          if (it.kind === 'room') rq[it.id] = it.qty;
          else if (it.kind === 'exp') eq[it.id] = it.qty;
          else if (it.kind === 'extra') xq[it.id] = it.qty;
        }
        if (Object.keys(rq).length) setRoomQty(rq);
        if (Object.keys(eq).length) setExpQty(eq);
        if (Object.keys(xq).length) setExtraQty(xq);
      }
    } catch { /* ignore */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Accumulate this venue's booking into ONE global cart (one order, many venues).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const key = window.location.pathname;
      const cart = JSON.parse(localStorage.getItem('tgs_cart') || '{}');
      if (!cart.venues) cart.venues = {};
      if (count > 0) {
        cart.venues[key] = {
          venueName, location, currency, venueImage, from, to, guests, buyout, cancellation, backHref: key,
          items: lines.map((l) => ({ key: l.key, kind: l.kind, id: l.id, label: l.label, detail: l.detail, qty: l.qty, max: l.max, amount: l.amount, unit: l.unit, image: l.image, eyebrow: l.eyebrow, qtyLabel: l.qtyLabel })),
          total,
        };
      } else {
        delete cart.venues[key];
      }
      cart.savedAt = Date.now();
      localStorage.setItem('tgs_cart', JSON.stringify(cart));
    } catch { /* storage unavailable — the sidebar still works */ }
  }, [hydrated, lines, from, to, guests, buyout, venueName, location, currency, venueImage, cancellation, total, count]);

  const features: { icon: React.ReactNode; label: React.ReactNode }[] = [];
  if (minStayNights) features.push({ icon: <IcClock />, label: <>Minimum stay: <b>{minStayNights} night{minStayNights === 1 ? '' : 's'}</b></> });
  if (allowBuyout && buyoutPlan) features.push({ icon: <IcLock />, label: 'Whole-venue buyout available' });
  if (cancellation) features.push({ icon: <IcShield />, label: cancellation });
  if (confirmation) features.push({ icon: <IcBolt />, label: confirmation });

  const GROUP_LABEL: Record<string, string> = { room: 'Accommodation', exp: 'Wellness services', extra: 'Room extras' };
  const groups = (['room', 'exp', 'extra'] as Kind[])
    .map((k) => ({ key: k, label: GROUP_LABEL[k], items: lines.filter((l) => l.kind === k) }))
    .filter((g) => g.items.length > 0);

  return (
    <CartCtx.Provider value={value}>
      {children}

      {/* Tucked away: a quiet trigger, bottom-right */}
      <button type="button" className="bc-trigger" onClick={() => setDrawer('open')} aria-label="Open booking" hidden={drawer !== 'min'}>
        <span className="bc-trigger-label">Your booking</span>
        <span className="bc-trigger-meta">{count > 0 ? `${count} · ${money(total, currency)}` : 'Start'}</span>
      </button>

      {/* The floating booking box */}
      {drawer !== 'min' && (
        <aside className={`bc-box bc-box-${drawer}`} aria-label="Your booking">
          <div className="bc-box-head">
            <span className="bc-box-title">Your booking</span>
            <div className="bc-box-controls">
              <button type="button" onClick={() => setDrawer(drawer === 'max' ? 'open' : 'max')} aria-label={drawer === 'max' ? 'Restore' : 'Expand'}>{drawer === 'max' ? '⤡' : '⤢'}</button>
              <button type="button" onClick={() => setDrawer('min')} aria-label="Tuck away">–</button>
            </div>
          </div>

          <div className="bc-box-body">
            {(summary || features.length > 0) && (
              <div className="bc-ov">
                <div className="bc-ov-h">Overview</div>
                {summary && <p className="bc-ov-desc">{summary}</p>}
                {features.map((f, i) => <div key={i} className="bc-feat">{f.icon}<span>{f.label}</span></div>)}
                <hr className="bc-rule strong" />
              </div>
            )}

            <div className="bc-bk-h">Your booking</div>
            <div className="bc-dates">
              <label className="bb-field"><span>Arrival</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="bb-field"><span>Departure</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
              <label className="bb-field"><span>Guests</span><input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} /></label>
            </div>

            {allowBuyout && buyoutPlan && (
              <div className="bc-buyout">
                <div className="bc-buyout-head">How to book</div>
                <button type="button" className={`bc-opt${!buyout ? ' on' : ''}`} onClick={() => setBuyout(false)}>
                  <span className="bc-opt-row">
                    <span className="bc-opt-name">Room by room</span>
                    <span className="bc-opt-price">{roomEstimate != null ? `from ${money(roomEstimate, currency)}` : 'Choose rooms'}</span>
                  </span>
                  {roomEstimate != null && <span className="bc-opt-pp">{money(roomEstimate / guestN, currency)} per person</span>}
                  {bestValue === 'rooms' && <span className="bc-best">Best value for your group</span>}
                </button>
                <button type="button" className={`bc-opt${buyout ? ' on' : ''}`} onClick={selectBuyout}>
                  <span className="bc-opt-row">
                    <span className="bc-opt-name">Whole venue</span>
                    <span className="bc-opt-price">{buyoutTotal != null ? money(buyoutTotal, currency) : 'Add dates'}</span>
                  </span>
                  {buyoutTotal != null && <span className="bc-opt-pp">{money(buyoutTotal / guestN, currency)} per person</span>}
                  {bestValue === 'buyout' && <span className="bc-best">Best value for your group</span>}
                  <span className="bc-opt-note">Exclusive use of all {rooms.length} room{rooms.length === 1 ? '' : 's'} and every space</span>
                </button>
              </div>
            )}

            {count === 0 && <p className="bb-empty">Nothing added yet. Choose rooms and experiences from the tabs, and they&rsquo;ll collect here.</p>}
            {count > 0 && groups.map((g) => (
              <div key={g.key} className="bc-grp">
                <div className="bc-grp-h">{g.label}</div>
                <ul className="bc-lines">
                  {g.items.map((l) => (
                    <li key={l.key} className="bc-line">
                      <span className="bc-line-what"><span>{l.label}</span><span className="bc-line-sub">{l.detail}</span></span>
                      <span className="bc-line-right">
                        {l.key === 'buyout' ? null : <Stepper value={l.qty} min={0} max={l.max} onChange={(n) => setQty(l.kind, l.id, n)} />}
                        <span className="bc-line-amt">{l.amount != null ? money(l.amount, currency) : '—'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="bc-box-foot">
            <div className="bc-total"><span>Estimated total</span><span>{money(total, currency)}</span></div>
            {anyUnpriced && <p className="bb-note">Some items are priced on request and are not in this estimate.</p>}
            <div className="bc-actions">
              <button type="button" className="bb-btn bb-btn-quiet" onClick={clear} disabled={count === 0}>Clear</button>
              <button type="button" className="bb-btn bb-btn-quiet" onClick={downloadQuote} disabled={count === 0}>Download quote</button>
              <button type="button" className="bb-btn bb-btn-primary" onClick={() => router.push('/booking')} disabled={count === 0}>Review booking</button>
            </div>
            <p className="bb-note">An estimate. The final quote, deposit and payment schedule are confirmed at review.</p>
          </div>
        </aside>
      )}
    </CartCtx.Provider>
  );
}
