'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  resolveSteps, readAcks, recordAck, nextDestination, cartShape, type BookingStep,
} from '@/lib/bookingSteps';

/* Before you book: the host step.
 *
 * A different question from the health step and deliberately a separate
 * screen. A guest needs to know whether something suits them; someone hiring a
 * venue needs to know what they are taking on. Merging the two would blur
 * whose duty is whose, which is the one thing these screens exist to keep
 * clear.
 *
 * The exclusions carry equal weight to the inclusions on purpose. A hirer who
 * assumed linen, or a cleaner, or the run of the kitchen finds out on arrival
 * with twenty guests behind them.
 */

type Settings = {
  venue_id: number;
  whats_included: string[] | null;
  whats_excluded: string[] | null;
  host_responsibilities: string[] | null;
  requires_public_liability: boolean | null;
  public_liability_minimum: number | null;
  requires_professional_indemnity: boolean | null;
  insurance_note: string | null;
  deposit_percent: number | null;
  deposit_amount: number | null;
  balance_due: string | null;
  security_bond: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  max_group_size: number | null;
  turnaround_days: number | null;
};

const money = (n: number | null | undefined) =>
  n == null ? null : `$${Number(n).toLocaleString('en-AU')}`;

export default function HostStepPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [steps, setSteps] = useState<BookingStep[]>([]);
  const [venues, setVenues] = useState<{ name: string; location: string; s: Settings | null }[]>([]);

  useEffect(() => {
    (async () => {
      let cart: any = null;
      try { cart = JSON.parse(localStorage.getItem('tgs_cart') ?? 'null'); } catch { /* ignore */ }
      if (!cart) { router.replace('/booking'); return; }

      const db = createClient();
      const resolved = await resolveSteps(db as never, cart);
      setSteps(resolved);

      if (!resolved.some((s) => s.step === 'host')) {
        router.replace(nextDestination(resolved, readAcks()));
        return;
      }

      const { venueIds } = cartShape(cart);
      const [{ data: rows }, { data: vs }] = await Promise.all([
        db.from('venue_booking_settings')
          .select('venue_id,whats_included,whats_excluded,host_responsibilities,requires_public_liability,public_liability_minimum,requires_professional_indemnity,insurance_note,deposit_percent,deposit_amount,balance_due,security_bond,checkin_time,checkout_time,max_group_size,turnaround_days')
          .in('venue_id', venueIds.length ? venueIds : [-1]),
        db.from('venues').select('id,venue_name').in('id', venueIds.length ? venueIds : [-1]),
      ]);

      const byId = new Map(((rows ?? []) as Settings[]).map((r) => [r.venue_id, r]));
      const slices = Object.values(cart.venues ?? {}) as any[];
      setVenues(slices.filter((v) => typeof v.venueId === 'number').map((v) => ({
        name: (vs ?? []).find((x: any) => x.id === v.venueId)?.venue_name ?? v.venueName,
        location: v.location ?? '',
        s: byId.get(v.venueId) ?? null,
      })));
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <div className="cart-wrap" />;

  const onwards = () => {
    recordAck('host');
    router.push(nextDestination(steps, { ...readAcks(), host: true }));
  };

  const insuranceLine = (s: Settings | null) => {
    if (!s) return null;
    const parts: string[] = [];
    if (s.requires_public_liability) {
      parts.push(s.public_liability_minimum
        ? `public liability insurance to a minimum of ${money(s.public_liability_minimum)}`
        : 'public liability insurance');
    }
    if (s.requires_professional_indemnity) {
      parts.push('professional indemnity cover for every practitioner you bring');
    }
    if (!parts.length) return null;
    return `You must hold ${parts.join(', and ')}.${s.insurance_note ? ` ${s.insurance_note}` : ''}`;
  };

  return (
    <div className="step-wrap">
      <nav className="step-rail" aria-label="Progress">
        <span>Your hire</span><i /><span className="on">Before you book</span><i /><span>Checkout</span>
      </nav>

      <p className="step-eyebrow">Before you book</p>
      <h1 className="step-h1">What this hire covers, and what it asks of you</h1>
      <p className="step-lede">
        You are hiring this venue to run your own retreat. That makes you responsible for your
        participants and for what happens in your programme. Please read what the venue includes,
        what it does not, and what it expects you to hold.
      </p>

      {venues.map((v, i) => {
        const s = v.s;
        const ins = insuranceLine(s);
        return (
          <section key={i} className="step-card">
            <div className="step-card-head">
              <span className="step-card-title">{v.name}</span>
              {v.location && <span className="step-card-meta">{v.location}</span>}
            </div>

            {ins && (
              <div className="step-item">
                <div className="step-req">
                  <p className="step-req-h">What you need to hold</p>
                  <p className="step-req-t">{ins}</p>
                </div>
              </div>
            )}

            {(s?.whats_included?.length || s?.whats_excluded?.length) && (
              <div className="step-cols">
                {!!s?.whats_included?.length && (
                  <div className="step-col">
                    <h4>Included in the hire</h4>
                    <ul>{s.whats_included.map((x, n) => <li key={n}>{x}</li>)}</ul>
                  </div>
                )}
                {!!s?.whats_excluded?.length && (
                  <div className="step-col step-col-out">
                    <h4>Not included</h4>
                    <ul>{s.whats_excluded.map((x, n) => <li key={n}>{x}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {!!s?.host_responsibilities?.length && (
              <div className="step-cols">
                <div className="step-col step-col-full">
                  <h4>What the venue expects you to take responsibility for</h4>
                  <ul>{s.host_responsibilities.map((x, n) => <li key={n}>{x}</li>)}</ul>
                </div>
              </div>
            )}

            {s && (
              <div className="step-terms">
                {s.deposit_percent != null && <div><b>Deposit</b><span>{s.deposit_percent}% on booking</span></div>}
                {s.deposit_percent == null && s.deposit_amount != null && <div><b>Deposit</b><span>{money(s.deposit_amount)}</span></div>}
                {s.balance_due && <div><b>Balance due</b><span>{s.balance_due}</span></div>}
                {s.security_bond != null && <div><b>Security bond</b><span>{money(s.security_bond)}</span></div>}
                {(s.checkin_time || s.checkout_time) && <div><b>Access</b><span>{s.checkin_time ?? '—'} to {s.checkout_time ?? '—'}</span></div>}
                {s.max_group_size != null && <div><b>Capacity</b><span>{s.max_group_size} guests</span></div>}
                {s.turnaround_days != null && <div><b>Changeover</b><span>{s.turnaround_days} day{s.turnaround_days === 1 ? '' : 's'} either side</span></div>}
              </div>
            )}
          </section>
        );
      })}

      <div className="step-stance">
        <h3>How this works</h3>
        <ul>
          <li>Your booking is with the venue. The Global Sanctum introduces and arranges it, and is
              not a party to your hire or to your retreat.</li>
          <li>Your participants book with you, not with us. We have no relationship with them and
              cannot give them information about your programme.</li>
          <li>Because of that, the duty to tell your participants what a practice involves, and to
              screen them for it, sits with you. We do that for anything booked through us; we
              cannot do it for anything booked through you.</li>
          <li>The venue&rsquo;s cancellation policy governs your hire. Your own terms with your
              participants are yours to set and to honour.</li>
        </ul>
      </div>

      <div className="step-ack">
        <label>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I have read what is included and excluded, I will hold the insurance the venue requires,
            and I accept responsibility for the participants I bring and for the programme I run.
            I have read the <Link href="/legal/health-wellness-disclaimer">Health &amp; Wellness Disclaimer</Link>.
          </span>
        </label>
      </div>

      <div className="step-acts">
        <Link className="step-back" href="/booking">&larr; Back to your hire</Link>
        <button type="button" className="step-go" disabled={!agreed} onClick={onwards}>
          Continue
        </button>
      </div>
    </div>
  );
}
