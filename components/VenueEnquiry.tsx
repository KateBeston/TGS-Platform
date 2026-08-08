'use client';

import { useState } from 'react';

/* The enquiry form on a venue page.
 *
 * Persists first and syncs to the CRM after, so an enquiry survives
 * ActiveCampaign being down or not yet wired — which it is not. A form
 * that posts straight to a CRM loses whatever the CRM refuses.
 *
 * Structured fields rather than one message box. The enquiries table is
 * the most valuable thing in the database and it can only report on what
 * was captured. */

export default function VenueEnquiry({
  venueId, venueName, marketplace,
}: { venueId: number; venueName: string; marketplace: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [trap, setTrap] = useState('');

  const [f, setF] = useState({
    firstName: '', surname: '', email: '', phone: '',
    dateFrom: '', dateTo: '', guests: '', notes: '',
    accessNeeds: '',
  });

  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const submit = async () => {
    if (busy) return;
    if (!f.email.trim() || !f.firstName.trim()) {
      setProblem('A name and an email, and we can take it from there.');
      return;
    }
    setBusy(true); setProblem('');

    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, venueId, marketplace, website: trap }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error ?? 'That did not go through.');
      setSent(true);
    } catch (e: any) {
      setProblem(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="enquiry enquiry-done">
        <h3>Thank you</h3>
        <p>
          We have your enquiry about {venueName} and will come back to you
          within a day. If your dates are tight, say so in a reply and we will
          move faster.
        </p>
      </div>
    );
  }

  return (
    <div className="enquiry">
      <h3>Enquire about {venueName}</h3>
      <p className="enquiry-sub">
        We answer within a day. Nothing is charged and nothing is committed.
      </p>

      <div className="trap" aria-hidden="true">
        <label htmlFor="v-site">Website</label>
        <input id="v-site" tabIndex={-1} autoComplete="off"
          value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>

      <div className="enquiry-grid">
        <div className="f">
          <label htmlFor="e-first">First name</label>
          <input id="e-first" value={f.firstName}
            onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="e-last">Surname</label>
          <input id="e-last" value={f.surname}
            onChange={(e) => set('surname', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="e-email">Email</label>
          <input id="e-email" type="email" value={f.email}
            onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="e-phone">Phone</label>
          <input id="e-phone" value={f.phone}
            onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="e-from">Arriving</label>
          <input id="e-from" type="date" value={f.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="e-to">Leaving</label>
          <input id="e-to" type="date" value={f.dateTo}
            onChange={(e) => set('dateTo', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="e-guests">How many people</label>
          <input id="e-guests" type="number" min={1} value={f.guests}
            onChange={(e) => set('guests', e.target.value)} />
        </div>
      </div>

      <div className="f">
        <label htmlFor="e-notes">What you have in mind</label>
        <textarea id="e-notes" rows={4} value={f.notes}
          onChange={(e) => set('notes', e.target.value)} />
      </div>

      {/* Asked directly rather than hoped for in the notes. Somebody who
          needs step-free access should not have to volunteer it in a box
          labelled "anything else". */}
      <div className="f">
        <label htmlFor="e-access">Anything anyone in your group needs</label>
        <input id="e-access" value={f.accessNeeds}
          placeholder="Step-free access, dietary requirements, anything at all"
          onChange={(e) => set('accessNeeds', e.target.value)} />
      </div>

      {problem && <p className="enquiry-problem">{problem}</p>}

      <button type="button" className="btn-solid" onClick={submit} disabled={busy}>
        {busy ? 'Sending' : 'Send the enquiry'}
      </button>

      <p className="enquiry-fine">
        By enquiring you agree to our <a href="/legal#terms">terms</a> and{' '}
        <a href="/legal#privacy">privacy policy</a>. Health and wellness
        services carry <a href="/legal#health">their own considerations</a>.
      </p>
    </div>
  );
}
