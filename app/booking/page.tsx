'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trackCartEvent } from '@/lib/track';

type Item = { key: string; kind: string; id: number; label: string; detail: string; qty: number; max: number; amount: number | null; unit: number | null; image: string | null; eyebrow: string; qtyLabel: string };
type VenueSlice = { venueName: string; location: string; currency: string | null; venueImage: string | null; from: string; to: string; guests: string; buyout: boolean; cancellation: string | null; freeCancelDays: number | null; backHref: string; items: Item[]; total: number };
type Cart = { venues: Record<string, VenueSlice> };

function money(a: number | null, c: string | null): string {
  if (a == null) return '—';
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: c || 'AUD', maximumFractionDigits: 0 }).format(a); }
  catch { return `${c || 'AUD'} ${Math.round(a)}`; }
}
function fmtDate(s: string) { if (!s) return null; try { return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s; } }
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
function isPast(f: string) { if (!f) return false; const d = new Date(f); return !isNaN(d.getTime()) && d < startOfToday(); }
function cancellationLabel(freeCancelDays: number | null, from: string): string | null {
  if (freeCancelDays == null) return null;
  if (from) {
    const d = new Date(from); if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() - freeCancelDays);
      if (d >= startOfToday()) return `Free cancellation until ${fmtDate(d.toISOString())}`;
      return 'Cancellation policy applies';
    }
  }
  return `Free cancellation up to ${freeCancelDays} days before arrival`;
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [resched, setResched] = useState<string | null>(null);

  useEffect(() => {
    let parsed: Cart | null = null;
    try { const r = localStorage.getItem('tgs_cart'); parsed = r ? JSON.parse(r) : null; setCart(parsed); } catch { /* ignore */ }
    setLoaded(true);
    try {
      const vs = parsed?.venues ? Object.values(parsed.venues).filter((v) => v.items?.length) : [];
      if (vs.length) trackCartEvent({ eventType: 'cart_view', metadata: { venues: vs.length, items: vs.reduce((n, v) => n + v.items.reduce((m, it) => m + it.qty, 0), 0), total: vs.reduce((s, v) => s + (v.total || 0), 0) } });
    } catch { /* ignore */ }
  }, []);

  const write = (next: Cart) => { setCart(next); try { localStorage.setItem('tgs_cart', JSON.stringify(next)); } catch { /* ignore */ } };
  const recompute = (v: VenueSlice): VenueSlice => ({ ...v, total: v.items.reduce((s, it) => s + (it.amount ?? 0), 0) });
  const setItemQty = (k: string, ik: string, qty: number) => {
    if (!cart) return;
    const v = cart.venues[k];
    const items = v.items.map((it) => it.key === ik ? { ...it, qty, amount: it.unit != null ? it.unit * qty : it.amount } : it);
    write({ ...cart, venues: { ...cart.venues, [k]: recompute({ ...v, items }) } });
  };
  const deleteItem = (k: string, ik: string) => {
    if (!cart) return;
    const v = cart.venues[k];
    const items = v.items.filter((it) => it.key !== ik);
    const venues = { ...cart.venues };
    if (items.length) venues[k] = recompute({ ...v, items }); else delete venues[k];
    write({ ...cart, venues });
  };
  const reschedule = (k: string, f: string, t: string) => { if (!cart) return; write({ ...cart, venues: { ...cart.venues, [k]: { ...cart.venues[k], from: f, to: t } } }); setResched(null); };
  const clearAll = () => write({ venues: {} });

  if (!loaded) return <div className="cart-wrap" />;

  const entries = cart?.venues ? Object.entries(cart.venues).filter(([, v]) => v.items?.length) : [];
  if (!entries.length) {
    return (
      <div className="cart-wrap">
        <div className="cart-empty">
          <h1 className="cart-h1">Your booking is empty</h1>
          <p>Add rooms, services or experiences from any venue and they&rsquo;ll gather here from across the site.</p>
          <Link className="cart-cta cart-cta-primary cart-empty-btn" href="/venues">Browse venues</Link>
        </div>
      </div>
    );
  }

  const grand = entries.reduce((s, [, v]) => s + (v.total || 0), 0);
  const currency = entries[0][1].currency;
  const itemCount = entries.reduce((s, [, v]) => s + v.items.reduce((n, it) => n + it.qty, 0), 0);
  const anyPast = entries.some(([, v]) => isPast(v.from));

  return (
    <div className="cart-wrap">
      <div className="cart-head">
        <div><h1 className="cart-h1">Your booking</h1><div className="cart-sub">{itemCount} item{itemCount === 1 ? '' : 's'} across {entries.length} venue{entries.length === 1 ? '' : 's'} · held for you</div></div>
        <div className="cart-head-actions"><button onClick={clearAll}>Clear all</button></div>
      </div>

      <div className="cart-cols">
        <div className="cart-main">
          {entries.map(([key, v]) => {
            const past = isPast(v.from);
            const meta = [v.location, [fmtDate(v.from), fmtDate(v.to)].filter(Boolean).join('–'), v.guests ? `${v.guests} guests` : null].filter(Boolean).join(' · ');
            return (
              <div key={key} className={`cv${past ? ' cv-past' : ''}`}>
                <div className="cv-head">
                  <div className="cv-thumb" style={v.venueImage ? { backgroundImage: `url(${v.venueImage})` } : undefined} />
                  <div className="cv-head-main"><div className="cv-name">{v.venueName}</div><div className="cv-meta">{meta}</div></div>
                </div>
                {past && <div className="cv-past-banner">These dates have passed. Reschedule to keep this venue, or remove it.</div>}
                <div className="cv-nest">
                  {v.items.map((it) => (
                    <div key={it.key} className="cv-item">
                      <div className="cv-ithumb" style={it.image ? { backgroundImage: `url(${it.image})` } : undefined} />
                      <div className="cv-item-main">
                        <div className="cv-eyebrow">{it.eyebrow}</div>
                        <div className="cv-item-name">{it.label}</div>
                        <div className="cv-item-detail">{[it.detail, cancellationLabel(v.freeCancelDays, v.from)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <div className="cv-item-r">
                        {it.qtyLabel && !past && it.key !== 'buyout' && (
                          <label className="cv-qty">{it.qtyLabel}
                            <select value={it.qty} onChange={(e) => setItemQty(key, it.key, Number(e.target.value))}>
                              {Array.from({ length: Math.max(it.max || 1, it.qty) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        )}
                        <div className="cv-price"><span className="cv-now">{money(it.amount, v.currency)}</span>{it.unit != null && it.qty > 1 ? <div className="cv-pp">{money(it.unit, v.currency)} each</div> : null}</div>
                        <div className="cv-acts">
                          {past ? <button type="button" className="cv-resched" onClick={() => setResched(key)}>Reschedule</button> : <Link className="cv-edit" href={v.backHref || '/venues'}>Edit</Link>}
                          <button type="button" className="cv-del" onClick={() => deleteItem(key, it.key)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cv-foot">
                  <Link className="cv-addmore" href={v.backHref || '/venues'}>+ Add more from this venue</Link>
                  <span className="cv-sub">Venue subtotal · {v.items.length} item{v.items.length === 1 ? '' : 's'}&nbsp;&nbsp;<b>{money(v.total, v.currency)}</b></span>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="cart-side">
          <div className="cart-box">
            <div className="cart-total"><span className="cart-total-l">Total · {itemCount} item{itemCount === 1 ? '' : 's'}</span><span className="cart-total-a">{money(grand, currency)}</span></div>
            <div className="cart-fees">Includes taxes &amp; fees</div>
            <hr className="cart-rule" />
            {entries.map(([key, v]) => <div key={key} className="cart-line"><span>{v.venueName}</span><span>{money(v.total, v.currency)}</span></div>)}
            <button type="button" className="cart-cta cart-cta-primary" disabled={anyPast} onClick={() => { trackCartEvent({ eventType: 'checkout_start', metadata: { venues: entries.length, items: itemCount, total: grand } }); router.push('/checkout'); }}>Checkout now</button>
            <Link className="cart-cta cart-cta-ghost" href="/venues">Continue browsing</Link>
            {anyPast && <p className="cart-warn">Reschedule or remove the past-due venues before checkout.</p>}
            <div className="cart-secure">Secure payments · encrypted</div>
          </div>
          <div className="cart-help">Need help with your booking?<b>We answer within a day</b></div>
        </aside>
      </div>

      <div className="cart-trust">
        <div className="cart-trust-item"><svg viewBox="0 0 24 24"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9 2.6.9-5.5-4-3.9 5.5-.8z" /></svg><b>Personally curated</b><span>Every venue visited and chosen, never listed by volume</span></div>
        <div className="cart-trust-item"><svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg><b>Secure &amp; protected</b><span>Encrypted payments and clear cancellation terms</span></div>
        <div className="cart-trust-item"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg><b>Cared for by a real team</b><span>Speak to a person, not a queue, whenever you need</span></div>
      </div>

      {resched && cart?.venues[resched] && (
        <RescheduleModal venueName={cart.venues[resched].venueName} from={cart.venues[resched].from} to={cart.venues[resched].to}
          onSave={(f, t) => reschedule(resched, f, t)} onClose={() => setResched(null)} />
      )}
    </div>
  );
}

function RescheduleModal({ venueName, from, to, onSave, onClose }: { venueName: string; from: string; to: string; onSave: (from: string, to: string) => void; onClose: () => void }) {
  const todayStr = startOfToday().toISOString().slice(0, 10);
  const [f, setF] = useState(from && !isPast(from) ? from : '');
  const [t, setT] = useState(to && !isPast(to) ? to : '');
  const valid = !!f && (!t || t >= f);
  return (
    <div className="ck-modal-back" onClick={onClose}>
      <div className="ck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ck-modal-head"><span className="ck-modal-title">New dates</span><button type="button" className="ck-modal-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="ck-modal-body">
          <p className="ck-field-note">{venueName} — choose new dates to keep this venue in your booking.</p>
          <div className="ck-two">
            <label className="ck-field"><span>Arrival</span><input type="date" min={todayStr} value={f} onChange={(e) => setF(e.target.value)} /></label>
            <label className="ck-field"><span>Departure</span><input type="date" min={f || todayStr} value={t} onChange={(e) => setT(e.target.value)} /></label>
          </div>
          <p className="ck-field-note">Live availability is checked once the availability calendar is on; for now you can set any future dates.</p>
        </div>
        <div className="ck-modal-foot"><button type="button" className="ck-outline" onClick={onClose}>Cancel</button><button type="button" className="ck-done" disabled={!valid} onClick={() => onSave(f, t)}>Update dates</button></div>
      </div>
    </div>
  );
}
