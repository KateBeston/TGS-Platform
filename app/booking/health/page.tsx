'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  resolveSteps, readAcks, recordAck, nextDestination, cartShape, type BookingStep,
} from '@/lib/bookingSteps';

/* Before you book: the health step.
 *
 * Shows what a practice involves, who it does not suit, and what the venue
 * does about it. Requirement first, so the action arrives before the reason.
 *
 * Nothing here collects health information. The tick records that the guest
 * was shown the notes; anything they disclose goes to the venue on the venue's
 * own form. Health information is sensitive information under the Privacy Act,
 * and holding it would put TGS in the business of judging suitability, which
 * the Health & Wellness Disclaimer says we do not do.
 */

type Safety = {
  practice_id: number; practice_name: string; heading: string;
  requirement: string | null; likelihood: string | null; guest_note: string | null;
  not_suitable_if: string | null; venue_safeguard: string | null;
};
type Doc = { document_id: number; venue_id: number; slug: string; name: string; version_label: string | null };

export default function HealthStepPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [steps, setSteps] = useState<BookingStep[]>([]);
  const [rows, setRows] = useState<{ venueName: string; serviceName: string; safety: Safety[] }[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [formVenues, setFormVenues] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      let cart: any = null;
      try { cart = JSON.parse(localStorage.getItem('tgs_cart') ?? 'null'); } catch { /* ignore */ }
      if (!cart) { router.replace('/booking'); return; }

      const db = createClient();
      const resolved = await resolveSteps(db as never, cart);
      setSteps(resolved);

      // Arrived at a step this booking does not need, or already done.
      if (!resolved.some((s) => s.step === 'health')) {
        router.replace(nextDestination(resolved, readAcks()));
        return;
      }

      const { venueIds, serviceIds } = cartShape(cart);

      const [{ data: services }, { data: venueDocs }, { data: venues }] = await Promise.all([
        db.from('venue_services')
          .select('id,venue_id,name,website_display_name,practice_id,requires_health_form')
          .in('id', serviceIds.length ? serviceIds : [-1]),
        db.from('venue_acceptance_documents')
          .select('document_id,venue_id,slug,name,version_label,document_type')
          .in('venue_id', venueIds.length ? venueIds : [-1]),
        db.from('venues').select('id,venue_name,requires_health_form')
          .in('id', venueIds.length ? venueIds : [-1]),
      ]);

      const practiceIds = Array.from(new Set(
        (services ?? []).map((s: any) => s.practice_id).filter(Boolean),
      ));
      const { data: safety } = await db.from('practice_safety_guest')
        .select('practice_id,practice_name,heading,requirement,likelihood,guest_note,not_suitable_if,venue_safeguard')
        .in('practice_id', practiceIds.length ? practiceIds : [-1]);

      const venueName = new Map((venues ?? []).map((v: any) => [v.id, v.venue_name]));
      const built = (services ?? []).map((s: any) => ({
        venueName: venueName.get(s.venue_id) ?? '',
        serviceName: s.website_display_name ?? s.name,
        safety: ((safety ?? []) as Safety[]).filter((r) => r.practice_id === s.practice_id),
      })).filter((r) => r.safety.length > 0);

      setRows(built);
      setDocs(((venueDocs ?? []) as any[])
        .filter((d) => d.document_type === 'Health & Participation') as Doc[]);
      setFormVenues(
        (venues ?? []).filter((v: any) =>
          v.requires_health_form ||
          (services ?? []).some((s: any) => s.venue_id === v.id && s.requires_health_form),
        ).map((v: any) => v.venue_name),
      );
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <div className="cart-wrap" />;

  const onwards = () => {
    recordAck('health');
    router.push(nextDestination(steps, { ...readAcks(), health: true }));
  };

  return (
    <div className="step-wrap">
      <nav className="step-rail" aria-label="Progress">
        <span>Your booking</span><i /><span className="on">Before you book</span><i /><span>Checkout</span>
      </nav>

      <p className="step-eyebrow">Before you book</p>
      <h1 className="step-h1">A few things worth knowing</h1>
      <p className="step-lede">
        Some of what you&rsquo;ve chosen has conditions attached. Please read them, and speak to your
        doctor if any of it applies to you.
      </p>

      {rows.map((r, i) => (
        <section key={i} className="step-card">
          <div className="step-card-head">
            <span className="step-card-title">{r.serviceName}</span>
            <span className="step-card-meta">{r.venueName}</span>
          </div>
          {r.safety.map((s, j) => (
            <div key={j} className="step-item">
              <p className="step-item-practice">{s.practice_name}</p>
              {s.requirement && (
                <div className="step-req">
                  <p className="step-req-h">What you need to do</p>
                  <p className="step-req-t">{s.requirement}</p>
                </div>
              )}
              {s.likelihood && <span className="step-like">Serious harm: {s.likelihood.toLowerCase()}</span>}
              {s.guest_note && <p className="step-note">{s.guest_note}</p>}
              {s.not_suitable_if && (
                <div className="step-unsuit">
                  <b>Not suitable if</b>
                  <p>{s.not_suitable_if}</p>
                </div>
              )}
              {s.venue_safeguard && (
                <p className="step-safe"><b>What this venue does:</b> {s.venue_safeguard}</p>
              )}
            </div>
          ))}
        </section>
      ))}

      {formVenues.length > 0 && (
        <section className="step-card">
          <div className="step-form-req">
            <h4>{formVenues.length === 1 ? 'This venue needs a form from you' : 'These venues need a form from you'}</h4>
            <p>
              {formVenues.join(', ')} {formVenues.length === 1 ? 'asks' : 'ask'} every guest to complete
              a health and participation form before arrival. It goes directly to them, not to us.
            </p>
          </div>
        </section>
      )}

      {docs.length > 0 && (
        <section className="step-card">
          <div className="step-form-req">
            <h4>Venue agreements to accept</h4>
            <ul className="step-docs">
              {docs.map((d) => (
                <li key={d.document_id}>
                  <Link href={`/legal/venue/${d.venue_id}/${d.slug}`}>{d.name}</Link>
                  {d.version_label && <span>{d.version_label}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="step-stance">
        <h3>How this works</h3>
        <ul>
          <li>These notes describe the practice, not you. We have no way of knowing whether something
              applies to your circumstances, and we are not making that judgement.</li>
          <li>We do not ask for or keep your health information. Where a venue needs a form, you
              complete it with them directly.</li>
          <li>The venue delivers the experience and is responsible for your safety during it.</li>
          <li>If you are unsure whether something suits you, ask the venue before you book rather than
              on arrival.</li>
        </ul>
      </div>

      <div className="step-ack">
        <label>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I have read the notes above and understand they describe the practices, not my own
            circumstances. Where a venue requires a health form, I will complete it with them
            directly. I have read the <Link href="/legal/health-wellness-disclaimer">Health &amp; Wellness Disclaimer</Link>.
          </span>
        </label>
      </div>

      <div className="step-acts">
        <Link className="step-back" href="/booking">&larr; Back to your booking</Link>
        <button type="button" className="step-go" disabled={!agreed} onClick={onwards}>
          Continue
        </button>
      </div>
    </div>
  );
}
