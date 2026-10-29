'use client';

import { useState } from 'react';

/* Enquiring from the card.
 *
 * A short form, because somebody who has not opened the listing yet has a
 * question rather than a brief. Four fields and the venue already filled in:
 * asking a host to retype the venue name they just clicked on is the kind of
 * friction that loses the enquiry.
 *
 * Posts to the same /api/enquiry the contact form uses, so it lands in the
 * enquiries table as structured data and triggers the same two emails.
 */
/* The enquire action and its form.
 *
 * Its own client component so the venue card can stay a server component:
 * the card imports lib/venues, which reaches next/headers, and a client
 * component cannot. Only the part that needs to be interactive is.
 */
export default function EnquireButton({
  venueId, venueName, marketplace,
}: { venueId: number; venueName: string; marketplace: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="card-enquire" onClick={() => setOpen(true)}>
        Enquire
      </button>
      {open && (
        <EnquireModal venueId={venueId} venueName={venueName} marketplace={marketplace}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function EnquireModal({ venueId, venueName, marketplace, onClose }: {
  venueId: number; venueName: string; marketplace: string | null; onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', email: '', guests: '', notes: '' });
  /* The honeypot. /api/enquiry has always checked for a filled `website`
     field and answered a success without writing anything — but this form
     never sent one, so the check could not fire here. The venue card is the
     most visible enquiry route on the site and it was the only one without
     the trap. */
  const [trap, setTrap] = useState('');

  const submit = async () => {
    setError(null);
    if (!form.firstName.trim()) return setError('A name, so we know who we are replying to.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setError('That does not look like an email address.');
    setSending(true);
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          email: form.email.trim().toLowerCase(),
          venueId: venueId,
          marketplace: marketplace,
          guestCount: form.guests ? Number(form.guests) : null,
          notes: form.notes.trim() || null,
          source: 'Venue card',
          website: trap,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Could not send that. Try again shortly.'); return; }
      setDone(true);
    } catch {
      setError('Could not send that. Try again shortly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="enq-back" onClick={onClose} role="presentation">
      <div className="enq-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="enq-head">
          <div>
            <div className="enq-eyebrow">Enquire</div>
            <div className="enq-venue">{venueName}</div>
          </div>
          <button type="button" className="enq-x" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {done ? (
          <div className="enq-body">
            <p className="enq-done">
              <strong>Thank you.</strong> We have your enquiry about {venueName} and
              will be in touch shortly. Check your inbox for confirmation.
            </p>
            <button type="button" className="enq-send" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="enq-body">
            {/* Off-screen rather than display:none, which is the one thing
                a bot checks for. Out of the tab order and out of the
                accessibility tree, so nobody using a keyboard or a screen
                reader ever meets it. */}
            <div className="trap" aria-hidden="true">
              <label htmlFor="enq-site">Website</label>
              <input id="enq-site" tabIndex={-1} autoComplete="off"
                value={trap} onChange={(e) => setTrap(e.target.value)} />
            </div>
            <label className="enq-field">
              <span>Your name</span>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </label>
            <label className="enq-field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="enq-field">
              <span>How many in your group</span>
              <input type="number" min={1} value={form.guests}
                onChange={(e) => setForm({ ...form, guests: e.target.value })} />
            </label>
            <label className="enq-field">
              <span>What would you like to know</span>
              <textarea rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {error && <p className="enq-error">{error}</p>}
            <button type="button" className="enq-send" onClick={submit} disabled={sending}>
              {sending ? 'Sending' : 'Send enquiry'}
            </button>
            <p className="enq-note">
              We reply personally, usually within a day. Nothing is booked by sending this.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
