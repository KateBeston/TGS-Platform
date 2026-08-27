'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Item = { key: string; kind: string; label: string; detail: string; qty: number; amount: number | null };
type Snapshot = {
  venueName: string; location: string; currency: string | null;
  from: string; to: string; guests: string; buyout: boolean;
  backHref: string; items: Item[]; total: number;
};

function money(amount: number | null, currency: string | null): string {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: currency || 'AUD', maximumFractionDigits: 0 }).format(amount);
  } catch { return `${currency || 'AUD'} ${Math.round(amount)}`; }
}

function fmtDate(s: string) {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

const GROUP: Record<string, string> = { room: 'Accommodation', exp: 'Wellness services', extra: 'Room extras' };

export default function BookingReviewPage() {
  const [cart, setCart] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem('tgs_booking'); setCart(raw ? JSON.parse(raw) : null); }
    catch { /* storage unavailable */ }
    setLoaded(true);
  }, []);

  if (!loaded) return <div className="br-wrap" />;

  if (!cart || !cart.items?.length) {
    return (
      <div className="br-wrap">
        <div className="br-empty">
          <h1 className="br-h1">Your booking is empty</h1>
          <p>Nothing has been added yet. Browse a venue and add rooms, services or experiences, and they&rsquo;ll gather here.</p>
          <Link className="br-btn br-btn-primary" href="/venues">Browse venues</Link>
        </div>
      </div>
    );
  }

  const groups = (['room', 'exp', 'extra'] as const)
    .map((k) => ({ key: k, label: GROUP[k], items: cart.items.filter((i) => i.kind === k) }))
    .filter((g) => g.items.length > 0);

  const arrival = fmtDate(cart.from);
  const departure = fmtDate(cart.to);

  return (
    <div className="br-wrap">
      <div className="br-eyebrow">Review</div>
      <h1 className="br-h1">Your booking</h1>
      <p className="br-venue">{cart.venueName}{cart.location ? ` · ${cart.location}` : ''}</p>

      <div className="br-panel">
        <div className="br-meta">
          <div><span className="br-meta-l">Arrival</span><span className="br-meta-v">{arrival ?? 'Not set'}</span></div>
          <div><span className="br-meta-l">Departure</span><span className="br-meta-v">{departure ?? 'Not set'}</span></div>
          <div><span className="br-meta-l">Guests</span><span className="br-meta-v">{cart.guests || '—'}</span></div>
        </div>

        {groups.map((g) => (
          <div key={g.key} className="br-grp">
            <div className="br-grp-h">{g.label}</div>
            {g.items.map((it) => (
              <div key={it.key} className="br-line">
                <span className="br-line-what"><span>{it.label}</span><span className="br-line-sub">{it.detail}</span></span>
                <span className="br-line-amt">{money(it.amount, cart.currency)}</span>
              </div>
            ))}
          </div>
        ))}

        <div className="br-total"><span>Estimated total</span><span>{money(cart.total, cart.currency)}</span></div>
        <p className="br-note">An estimate. The final quote, deposit and payment schedule are confirmed when you request to book.</p>
        <div className="br-terms">
          <Link href="/legal">Booking terms</Link> · <Link href="/legal">Cancellation policy</Link> · <Link href="/legal">Health &amp; wellness</Link>
        </div>
      </div>

      <div className="br-actions">
        <Link className="br-btn br-btn-quiet" href={cart.backHref || '/venues'}>Edit booking</Link>
        <button type="button" className="br-btn br-btn-primary" disabled>Request to book</button>
      </div>
      <p className="br-soon">Checkout is next — this is where guest details, membership and payment will go.</p>
    </div>
  );
}
