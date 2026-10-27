'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitBooking } from '@/app/actions/submitBooking';
import { trackCartEvent, trackStepOnce, trackStepBack, useAbandonIfLeft, cartSessionId } from '@/lib/track';
import { recordCheckoutContact } from '@/app/actions/checkoutContact';
import { useKeepHolds } from '@/lib/holdKeeper';
import AgreementPanel, { type AgreementResult } from '@/components/AgreementPanel';
import { agreementsForCart, type ResolvedAgreements } from '@/app/actions/agreements';
import CheckoutIdentity from '@/components/CheckoutIdentity';
import { createClient } from '@/lib/supabase/client';
import { fetchTgsAcceptanceDocs, fetchVenueAcceptanceDocs, contextsFromBooking, type AcceptanceDoc, type VenueAcceptanceDoc } from '@/lib/acceptance';
import { resolveSteps, readAcks, nextDestination, clearAcks } from '@/lib/bookingSteps';
import { clearCartToken } from '@/lib/cartToken';

type Item = { key: string; kind: string; id?: number; label: string; detail: string; qty: number; amount: number | null; eyebrow: string };
type VenueSlice = { venueName: string; venueId?: number | null; location: string; currency: string | null; from: string; to: string; guests: string; cancellation: string | null; freeCancelDays: number | null; backHref: string; items: Item[]; total: number };
type Cart = { venues: Record<string, VenueSlice> };
type Contact = { first: string; last: string; email: string; phone: string; marketing?: boolean };

/* The marketing consent wording, in one place.
 *
 * Shown on screen and stored with the consent from this same constant, so
 * the two cannot drift. A consent record that does not say what the person
 * agreed to proves nothing, and copy that has moved on since they agreed
 * is worse than no record at all. */
const MARKETING_CONSENT_TEXT =
  'Keep me posted on new venues, experiences and offers from The Global Sanctum. '
  + 'I can unsubscribe at any time.';

function money(a: number | null, c: string | null) { if (a == null) return '—'; try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: c || 'AUD', maximumFractionDigits: 0 }).format(a); } catch { return `${c || 'AUD'} ${Math.round(a)}`; } }
function fmtDate(s: string) { if (!s) return null; try { return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s; } }
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
function cancellationLabel(freeCancelDays: number | null, from: string): string | null {
  if (freeCancelDays == null) return null;
  if (from) { const d = new Date(from); if (!isNaN(d.getTime())) { d.setDate(d.getDate() - freeCancelDays); if (d >= startOfToday()) return `Free cancellation until ${fmtDate(d.toISOString())}`; return 'Cancellation policy applies'; } }
  return `Free cancellation up to ${freeCancelDays} days before arrival`;
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [modal, setModal] = useState(false);
  /* What this basket actually calls for, resolved from its item codes.
     Null until it has been asked for; an empty result is a real answer. */
  const [agreements, setAgreements] = useState<ResolvedAgreements | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState(0);
  const [snap, setSnap] = useState<Cart | null>(null);
  const [tgsDocs, setTgsDocs] = useState<AcceptanceDoc[]>([]);
  const [venueDocs, setVenueDocs] = useState<VenueAcceptanceDoc[]>([]);
  /* Whether the review screen was actually shown, rather than passed
     through on the way back to an outstanding step. Only a real visit can
     be abandoned, so a guest bounced off this screen must not be counted
     as having given up on it. */
  const [onReview, setOnReview] = useState(false);

  useEffect(() => {
    try { const r = localStorage.getItem('tgs_cart'); setCart(r ? JSON.parse(r) : null); const c = localStorage.getItem('tgs_contact'); if (c) setContact(JSON.parse(c)); } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  /* Nobody reaches checkout with a step outstanding.
     Typing /checkout skips the screens but not this: the steps are re-resolved
     here and the guest is sent back to the first one they have not done. The
     real gate is server-side in submitBooking; this is so the journey makes
     sense rather than so it is secure. */
  useEffect(() => {
    if (!cart) return;
    let live = true;
    (async () => {
      const steps = await resolveSteps(createClient() as never, cart);
      if (!live || !steps.length) {
        trackStepOnce('checkout', 'view');
        setOnReview(true);
        return;
      }
      const dest = nextDestination(steps, readAcks());
      if (dest !== '/checkout') {
        /* Sent back because a step is outstanding. Worth its own event:
           a guest bounced off the review screen is a different problem
           from one who never reached it. */
        trackStepOnce('checkout', 'blocked', { sent_to: dest });
        router.replace(dest);
        return;
      }
      trackStepOnce('checkout', 'view');
      setOnReview(true);
    })();
    return () => { live = false; };
  }, [cart, router]);

  /* Watches for the guest leaving the review without booking. Reports
     nothing if they finished, or if they went back to the cart. */
  useAbandonIfLeft('checkout', onReview);

  /* Keeps whatever times this cart is holding while the guest is still on
     this screen. Twenty minutes was long enough to choose a time and too
     short to then read the terms and check out, so a hold lapsed under
     people who were sitting right here. Stops once they have booked:
     the hold has become a booking item by then and renewing it would be
     holding a time against its own booking. */
  useKeepHolds(!done && onReview);

  /* What this basket calls for, asked once when the cart settles.
     The lines carry the kind and id they were added with, and the
     database turns those into item codes and then into agreements, so
     the browser never has to know which document belongs to what. */
  useEffect(() => {
    if (!cart) return;
    let live = true;
    const lines = Object.values(cart.venues)
      .flatMap((v) => v.items ?? [])
      .map((i) => ({ kind: i.kind, id: i.id }))
      .filter((i) => i.kind && i.id != null);
    (async () => {
      const resolved = await agreementsForCart(lines);
      if (live) setAgreements(resolved);
    })().catch(() => {
      /* An empty result still renders, as nothing to agree to rather
         than a broken screen. The server refuses the booking if a
         required document was never accepted, so this cannot wave
         somebody through. */
      if (live) setAgreements({ documents: [], alerts: [], missingText: [] });
    });
    return () => { live = false; };
  }, [cart]);

  /* What the guest is asked to accept. Read from the register rather than
     hardcoded, so it is exactly what submitBooking will record. */
  useEffect(() => {
    if (!cart) return;
    const slices = Object.values(cart.venues ?? {}) as any[];
    const ids = slices
      .map((v) => v.venueId)
      .filter((n): n is number => typeof n === 'number');
    let live = true;
    (async () => {
      try {
        const db = createClient();
        const [tgs, ven] = await Promise.all([
          /* Which documents this booking calls for, from what is in it rather
             than from how the venue is classified. */
          fetchTgsAcceptanceDocs(db as never, contextsFromBooking(slices)),
          fetchVenueAcceptanceDocs(db as never, Array.from(new Set(ids))),
        ]);
        if (live) { setTgsDocs(tgs); setVenueDocs(ven); }
      } catch { /* the checkbox still carries the standing terms */ }
    })();
    return () => { live = false; };
  }, [cart]);

  if (!loaded) return <div className="cart-wrap" />;
  const entries = cart?.venues ? Object.values(cart.venues).filter((v) => v.items?.length) : [];
  if (!entries.length) {
    return <div className="cart-wrap"><div className="cart-empty"><h1 className="cart-h1">Your booking is empty</h1><p>Add something from a venue, then come back to check out.</p><Link className="cart-cta cart-cta-primary cart-empty-btn" href="/venues">Browse venues</Link></div></div>;
  }
  const currency = entries[0].currency;
  const grand = entries.reduce((s, v) => s + (v.total || 0), 0);
  const contactDone = !!(contact && contact.first && contact.email);

  /* Each venue is paid in its own currency, so the guest's card is charged in
     that currency and their issuer applies the conversion. Disclose it whenever
     anything in the cart is priced outside AUD. */
  const venueNameById = new Map<number, string>();
  for (const v of entries) if (typeof v.venueId === 'number') venueNameById.set(v.venueId, v.venueName);

  const currencies = Array.from(new Set(entries.map((v) => (v.currency || 'AUD').toUpperCase())));
  const foreignCurrency = currencies.some((c) => c !== 'AUD');
  const currencyList = currencies.length === 1
    ? currencies[0]
    : `${currencies.slice(0, -1).join(', ')} and ${currencies[currencies.length - 1]}`;

  /* Kept locally so the review screen fills in at once, and sent to the
     server so the person exists in the portal from the moment they
     identify themselves rather than only if they finish. Fire and forget:
     a failure here must never stand between somebody and a booking, and
     the final submit records them regardless. */
  const saveContact = (c: Contact) => {
    setContact(c);
    try { localStorage.setItem('tgs_contact', JSON.stringify(c)); } catch { /* ignore */ }
    setModal(false);
    void recordCheckoutContact({
      first: c.first, last: c.last, email: c.email, phone: c.phone,
      sessionId: cartSessionId(),
      marketing: c.marketing === true,
      consentText: MARKETING_CONSENT_TEXT,
    }).catch(() => { /* never block the booking */ });
  };

  const submit = async (signed: AgreementResult) => {
    if (!cart || !contactDone || submitting) return;
    const snapshot = cart;
    setSubmitting(true); setErr(''); setStep(0);
    const t1 = setTimeout(() => setStep(1), 550);
    const t2 = setTimeout(() => setStep(2), 1150);
    const res = await submitBooking(snapshot as any, { name: `${contact!.first} ${contact!.last ?? ''}`.trim(), email: contact!.email, phone: contact!.phone }, Object.keys(readAcks()).filter((k) => readAcks()[k]), {
      sectionsRead: signed.sectionsRead,
      typedAffirmation: signed.typed,
      signatureKind: signed.signature?.kind ?? null,
      signatureName: signed.signature?.kind === 'typed' ? signed.signature.name : null,
      signatureImage: signed.signature?.kind === 'drawn' ? signed.signature.dataUrl : null,
    });
    clearTimeout(t1); clearTimeout(t2);
    if (res.ok) {
      setStep(3);
      /* Both, and this one first. `book` is the funnel's outcome; this is
         the review screen reporting that it was finished rather than left,
         which is what stops the abandonment watch below filing a completed
         booking as an abandoned one on the way to the confirmation. */
      trackStepOnce('checkout', 'complete');
      trackCartEvent({ eventType: 'book', metadata: { orderReference: res.orderReference } });
      setSnap(snapshot);
      /* The token goes with the cart. The holds it made are now a real
         booking, and a fresh token means the next person on a shared
         computer cannot inherit them. */
      try { localStorage.removeItem('tgs_cart'); clearAcks(); clearCartToken(); }
      catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 650));
      setSubmitting(false);
      setDone(res.orderReference);
    } else { setSubmitting(false); setErr(res.error); }
  };

  const STEPS = ['Connecting with the venue', 'Holding your places', 'Preparing your request', 'Confirming your booking'];

  if (done) {
    const cv = snap?.venues ? Object.values(snap.venues).filter((v) => v.items?.length) : [];
    const heldTotal = cv.reduce((sm, v) => sm + (v.total || 0), 0);
    const cur = cv[0]?.currency || 'AUD';
    return (
      <div className="cart-wrap">
        <div className="ck-cf">
          <div className="ck-cf-tick" aria-hidden="true">✓</div>
          <div className="ck-eyebrow">Booking requested</div>
          <h1 className="cart-h1">Your booking is held</h1>
          <p className="ck-cf-sub">We&rsquo;ve received your request and each venue is confirming your dates. Nothing has been charged.</p>
          <p className="ck-cf-ref">Reference <b>{done}</b></p>

          <div className="ck-cf-actions">
            <button type="button" className="ck-cf-action" onClick={() => window.print()}>Print confirmation</button>
            <span className="ck-cf-action ck-cf-action-off">Download summary</span>
            <span className="ck-cf-action ck-cf-action-off">Resend confirmation email</span>
          </div>

          <div className="ck-cf-panel">
            <p>Thank you. Your request has been sent to {cv.length === 1 ? <b>{cv[0].venueName}</b> : <>each venue</>}. The Global Sanctum arranged the introduction; your booking is with the venue and their terms apply to your stay. We&rsquo;ll be in touch by email at <b>{contact?.email}</b> as each venue confirms.</p>
            <p>If you don&rsquo;t see an email shortly, do check your spam or junk folder.</p>
          </div>

          <h2 className="ck-cf-sec">Your booking</h2>
          {cv.map((v, i) => (
            <div key={i} className="ck-cf-card">
              <div className="ck-cf-card-head">
                <div className="cv-name">{v.venueName}</div>
                <div className="cv-meta">{[v.location, [fmtDate(v.from), fmtDate(v.to)].filter(Boolean).join('–'), v.guests ? `${v.guests} guests` : null].filter(Boolean).join(' · ')}</div>
              </div>
              {v.items.map((it) => (
                <div key={it.key} className="ck-cf-line">
                  <div className="ck-cf-line-l">
                    <div className="cv-eyebrow">{it.eyebrow}</div>
                    <div className="ck-cf-line-name">{it.label}{it.qty > 1 ? ` · ×${it.qty}` : ''}</div>
                    <div className="ck-cf-line-status">{it.amount != null ? 'Held — the venue will confirm your time' : 'Held — priced on confirmation'}</div>
                  </div>
                  <div className="ck-cf-line-r">{it.amount != null ? money(it.amount, v.currency) : 'To be quoted'}</div>
                </div>
              ))}
            </div>
          ))}

          <div className="ck-cf-sum">
            <div className="ck-cf-sum-row ck-cf-sum-total"><span>Held total</span><b>{money(heldTotal, cur)}</b></div>
            <div className="ck-cf-sum-note">Anything shown as &ldquo;to be quoted&rdquo; is confirmed with the venue before anything is charged.</div>
          </div>

          <Link href="/experiences" className="cart-cta cart-cta-primary" style={{ display: 'inline-block', width: 'auto', padding: '13px 28px', textDecoration: 'none' }}>Continue exploring</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-wrap">
      {submitting && (
        <div className="ck-proc-back">
          <div className="ck-proc">
            <h2 className="ck-proc-h">We&rsquo;re confirming your booking</h2>
            <p className="ck-proc-sub">Stay on this screen until your confirmation appears.</p>
            <div className="ck-proc-steps">
              {STEPS.map((label, i) => (
                <div key={i} className={`ck-proc-step ${i < step ? 'is-done' : i === step ? 'is-active' : ''}`}>
                  <span className="ck-proc-mark">{i < step ? '✓' : i + 1}</span>
                  <span className="ck-proc-label">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="cart-head"><div><div className="ck-eyebrow">Checkout</div><h1 className="cart-h1">Complete your booking</h1></div><Link className="cart-head-actions" href="/booking" onClick={() => trackStepBack('checkout')} style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold-dark)', textDecoration: 'underline' }}>Back to cart</Link></div>

      <div className="cart-cols">
        <div className="cart-main">
          {/* Before the review, because which way they are checking out
              changes nothing below it and everything about what the page
              is asking of them. */}
          <CheckoutIdentity email={contact?.email ?? null} />

          <section className="ck-sec">
            <h2 className="ck-h2">Review your booking</h2>
            {entries.map((v, i) => (
              <div key={i} className="cv">
                <div className="cv-head"><div className="cv-head-main"><div className="cv-name">{v.venueName}</div><div className="cv-meta">{[v.location, [fmtDate(v.from), fmtDate(v.to)].filter(Boolean).join('–'), v.guests ? `${v.guests} guests` : null].filter(Boolean).join(' · ')}</div></div></div>
                <div className="cv-nest">
                  {v.items.map((it) => (
                    <div key={it.key} className="cv-item">
                      <div className="cv-item-main"><div className="cv-eyebrow">{it.eyebrow}</div><div className="cv-item-name">{it.label}</div><div className="cv-item-detail">{[it.qty > 1 ? `×${it.qty}` : null, it.detail, cancellationLabel(v.freeCancelDays, v.from)].filter(Boolean).join(' · ')}</div></div>
                      <div className="cv-item-r"><div className="cv-price"><span className="cv-now">{money(it.amount, v.currency)}</span></div></div>
                    </div>
                  ))}
                </div>
                <div className="cv-foot"><span /><span className="cv-sub">Venue subtotal&nbsp;&nbsp;<b>{money(v.total, v.currency)}</b></span></div>
              </div>
            ))}
          </section>

          <section className="ck-sec">
            <h2 className="ck-h2">Who&rsquo;s going?</h2>
            <div className="ck-contact">
              <div className="ck-contact-l">
                <div className="ck-contact-name">{contactDone ? `${contact!.first} ${contact!.last}`.trim() : 'Primary contact'}</div>
                <div className="ck-pills">{!contactDone && <span className="ck-pill ck-pill-warn">Details required</span>}<span className="ck-pill">Primary contact</span></div>
                {contactDone && contact!.email && <div className="ck-contact-email">{contact!.email}</div>}
              </div>
              <button type="button" className="ck-outline" onClick={() => setModal(true)}>{contactDone ? 'Edit details' : 'Add details'}</button>
            </div>
          </section>


          <section className="ck-sec">
            <h2 className="ck-h2">How would you like to pay?</h2>
            <div className="ck-stub">Nothing is charged now. Each venue confirms your dates first, and payment is arranged with the venue after that.</div>
            <ul className="ck-notes">
              <li>Your booking is with the venue. The Global Sanctum introduces and arranges it, and is not a party to your stay. The venue&rsquo;s own terms and cancellation policy govern the booking and any refund.</li>
              <li>Payment is made to the venue, so the venue&rsquo;s name may appear on your card or bank statement rather than The Global Sanctum.</li>
              {foreignCurrency && <li>This booking is priced and charged in {currencyList}. Any amount shown in another currency is indicative only, and your card issuer sets the conversion rate and any foreign transaction fee.</li>}
            </ul>
            {/* What this basket calls for, read one part at a time.
                Resolved from the item codes behind the cart rather than
                from the booking as a whole, so a sauna class brings its
                waiver and a venue's own house rules arrive alongside
                TGS's terms, named as the venue's rather than ours. */}
            {agreements && (agreements.documents.length > 0) ? (
              <AgreementPanel
                heading="Before you book"
                intro="Open and read each one. Once you have opened them all you can agree to the lot in a single tick, then confirm below."
                sections={agreements.documents.map((d) => ({
                  key: `${d.party === 'the venue' ? 'v' : 't'}-${d.versionId}`,
                  title: d.name,
                  summary: [d.summary, d.party === 'the venue'
                    ? `From ${d.venueName ?? 'the venue'}, not The Global Sanctum.`
                    : null].filter(Boolean).join(' '),
                  body: d.body,
                }))}
                masterLabel={`I have read and agree to all ${agreements.documents.length} of the above.`}
                masterHint="Open each one above to enable this"
                statement="I confirm my booking is with the venue and that their terms and cancellation policy govern it. The Global Sanctum introduces and arranges the booking and is not a party to my stay."
                affirmPhrase="I agree"
                signatureLabel="Sign below to confirm"
                confirmLabel="Request to book"
                busy={submitting}
                error={err || null}
                onConfirm={submit}
              />
            ) : (
              <>
                <p className="cart-secure">Preparing what you need to agree to…</p>
                <button type="button" className="cart-cta cart-cta-primary" disabled>Request to book</button>
              </>
            )}
            {err && <p className="ck-err">{err}</p>}
            {!contactDone && <p className="cart-secure">Add your contact details above to request this booking.</p>}
            <p className="cart-secure">We use secure transmission and encrypted storage to protect your personal information.</p>
          </section>
        </div>

        <aside className="cart-side">
          <div className="cart-box">
            <div className="cart-total"><span className="cart-total-l">Summary</span><span className="cart-total-a">{money(grand, currency)}</span></div>
            <div className="cart-fees">Includes taxes &amp; fees</div>
            <hr className="cart-rule" />
            {entries.map((v, i) => <div key={i} className="cart-line"><span>{v.venueName}</span><span>{money(v.total, v.currency)}</span></div>)}
            <div className="cart-secure">Secure payments · encrypted</div>
          </div>
          <div className="cart-help">Need help with your booking?<b>We answer within a day</b></div>
        </aside>
      </div>

      {modal && <ContactModal initial={contact} onSave={saveContact} onClose={() => setModal(false)} />}
    </div>
  );
}

function ContactModal({ initial, onSave, onClose }: { initial: Contact | null; onSave: (c: Contact) => void; onClose: () => void }) {
  const [first, setFirst] = useState(initial?.first ?? '');
  const [last, setLast] = useState(initial?.last ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [ok, setOk] = useState(false);
  /* Unticked unless they ticked it before. Deliberately not part of
     `valid`: the booking must not depend on somebody agreeing to
     marketing, or it stops being a choice. */
  const [marketing, setMarketing] = useState(initial?.marketing === true);
  const valid = first.trim() && email.trim() && ok;
  return (
    <div className="ck-modal-back" onClick={onClose}>
      <div className="ck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ck-modal-head"><span className="ck-modal-title">Primary Contact</span><button type="button" className="ck-modal-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="ck-modal-body">
          <div className="ck-two"><label className="ck-field"><span>First name</span><input value={first} onChange={(e) => setFirst(e.target.value)} /></label><label className="ck-field"><span>Last name</span><input value={last} onChange={(e) => setLast(e.target.value)} /></label></div>
          <div className="ck-two"><label className="ck-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. hello@email.com" /></label><label className="ck-field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61" /></label></div>
          <p className="ck-field-note">All communications about the booking will be sent here.</p>
          <label className="ck-agree"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>I&rsquo;m authorised to share these details and agree to The Global Sanctum&rsquo;s <Link href="/legal/privacy-policy">privacy policy</Link>.</span></label>
          <label className="ck-agree ck-agree-optional"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /><span>{MARKETING_CONSENT_TEXT}</span></label>
        </div>
        <div className="ck-modal-foot"><button type="button" className="ck-outline" onClick={onClose}>Save &amp; complete later</button><button type="button" className="ck-done" disabled={!valid} onClick={() => onSave({ first, last, email, phone, marketing })}>Done</button></div>
      </div>
    </div>
  );
}
