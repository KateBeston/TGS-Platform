'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { submitBooking } from '@/app/actions/submitBooking';
import { trackCartEvent } from '@/lib/track';

type Item = { key: string; kind: string; label: string; detail: string; qty: number; amount: number | null; eyebrow: string };
type VenueSlice = { venueName: string; location: string; currency: string | null; from: string; to: string; guests: string; cancellation: string | null; freeCancelDays: number | null; backHref: string; items: Item[]; total: number };
type Cart = { venues: Record<string, VenueSlice> };
type Contact = { first: string; last: string; email: string; phone: string };

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
  const [loaded, setLoaded] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [modal, setModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    try { const r = localStorage.getItem('tgs_cart'); setCart(r ? JSON.parse(r) : null); const c = localStorage.getItem('tgs_contact'); if (c) setContact(JSON.parse(c)); } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  if (!loaded) return <div className="cart-wrap" />;
  const entries = cart?.venues ? Object.values(cart.venues).filter((v) => v.items?.length) : [];
  if (!entries.length) {
    return <div className="cart-wrap"><div className="cart-empty"><h1 className="cart-h1">Your booking is empty</h1><p>Add something from a venue, then come back to check out.</p><Link className="cart-cta cart-cta-primary cart-empty-btn" href="/venues">Browse venues</Link></div></div>;
  }
  const currency = entries[0].currency;
  const grand = entries.reduce((s, v) => s + (v.total || 0), 0);
  const contactDone = !!(contact && contact.first && contact.email);

  const saveContact = (c: Contact) => { setContact(c); try { localStorage.setItem('tgs_contact', JSON.stringify(c)); } catch { /* ignore */ } setModal(false); };

  const submit = async () => {
    if (!cart || !contactDone || !agreed || submitting) return;
    setSubmitting(true); setErr('');
    const res = await submitBooking(cart as any, { name: `${contact!.first} ${contact!.last ?? ''}`.trim(), email: contact!.email, phone: contact!.phone });
    setSubmitting(false);
    if (res.ok) {
      trackCartEvent({ eventType: 'book', metadata: { orderReference: res.orderReference } });
      try { localStorage.removeItem('tgs_cart'); } catch { /* ignore */ }
      setDone(res.orderReference);
    } else { setErr(res.error); }
  };

  if (done) {
    return (
      <div className="cart-wrap">
        <div className="ck-done-wrap">
          <div className="ck-done-tick" aria-hidden="true">✓</div>
          <div className="ck-eyebrow">Booking requested</div>
          <h1 className="cart-h1">We&rsquo;ve received your request</h1>
          <p className="ck-done-ref">Reference <b>{done}</b></p>
          <p className="ck-done-msg">Your booking is held while each venue confirms your dates. We&rsquo;ll be in touch by email at {contact?.email}. Nothing has been charged.</p>
          <Link href="/experiences" className="cart-cta cart-cta-primary" style={{ display: 'inline-block', width: 'auto', padding: '13px 28px', textDecoration: 'none' }}>Continue exploring</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-wrap">
      <div className="cart-head"><div><div className="ck-eyebrow">Checkout</div><h1 className="cart-h1">Complete your booking</h1></div><Link className="cart-head-actions" href="/booking" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold-dark)', textDecoration: 'underline' }}>Back to cart</Link></div>

      <div className="cart-cols">
        <div className="cart-main">
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

          <section className="ck-sec"><h2 className="ck-h2">Protect yourself if you need to cancel</h2><div className="ck-stub">Cancellation protection will appear here. It&rsquo;s an insurance product provided through a licensed partner, so it goes live once that arrangement is in place.</div></section>

          <section className="ck-sec">
            <h2 className="ck-h2">How would you like to pay?</h2>
            <div className="ck-stub">Payment is coming in the next stage — card in test mode first, then reviewed before anything real is charged.</div>
            <label className="ck-agree"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>I agree to the <Link href="/legal">Terms &amp; Conditions</Link>, <Link href="/legal">Refund Policy</Link> and <Link href="/legal">Privacy Policy</Link>.</span></label>
            <button type="button" className="cart-cta cart-cta-primary" disabled={!contactDone || !agreed || submitting} onClick={submit}>{submitting ? 'Sending your request…' : 'Request to book'}</button>
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
  const valid = first.trim() && email.trim() && ok;
  return (
    <div className="ck-modal-back" onClick={onClose}>
      <div className="ck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ck-modal-head"><span className="ck-modal-title">Primary Contact</span><button type="button" className="ck-modal-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="ck-modal-body">
          <div className="ck-two"><label className="ck-field"><span>First name</span><input value={first} onChange={(e) => setFirst(e.target.value)} /></label><label className="ck-field"><span>Last name</span><input value={last} onChange={(e) => setLast(e.target.value)} /></label></div>
          <div className="ck-two"><label className="ck-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. hello@email.com" /></label><label className="ck-field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61" /></label></div>
          <p className="ck-field-note">All communications about the booking will be sent here.</p>
          <label className="ck-agree"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>I&rsquo;m authorised to share these details and agree to The Global Sanctum&rsquo;s <Link href="/legal">privacy policy</Link>.</span></label>
        </div>
        <div className="ck-modal-foot"><button type="button" className="ck-outline" onClick={onClose}>Save &amp; complete later</button><button type="button" className="ck-done" disabled={!valid} onClick={() => onSave({ first, last, email, phone })}>Done</button></div>
      </div>
    </div>
  );
}
