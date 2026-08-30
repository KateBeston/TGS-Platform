'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import PhoneField from '@/components/PhoneField';
import { trackOnce } from '@/lib/track';

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
  const [countries, setCountries] = useState<{ id: number; name: string; iso_code: string; dialling_code: string }[]>([]);
  useEffect(() => { createClient().from('countries').select('id,name,iso_code,dialling_code').order('name').then(({ data }) => setCountries(data ?? [])); }, []);
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
      // On the confirmed response, not on the click.
      trackOnce('enquiry_submitted', { venue_id: venueId, marketplace });
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
        <div className="f f--wide">
          <label htmlFor="e-phone">Phone</label>
          <PhoneField countries={countries} value={f.phone}
            onChange={(e164) => set('phone', e164)} defaultIso="AU" />
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
          {/* A count, not a typed number. Typing into a number field invites
              a blank, a zero, or a stray keystroke; two buttons cannot. */}
          <div className="e-count">
            <button type="button" aria-label="Fewer people"
              onClick={() => set('guests', String(Math.max(1, (Number(f.guests) || 1) - 1)))}
              disabled={(Number(f.guests) || 1) <= 1}>&minus;</button>
            <input id="e-guests" type="number" min={1} inputMode="numeric" value={f.guests || 1}
              onChange={(e) => set('guests', e.target.value.replace(/\D/g, ''))} />
            <button type="button" aria-label="More people"
              onClick={() => set('guests', String((Number(f.guests) || 1) + 1))}>+</button>
          </div>
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

      {/* Pointed at the documents themselves rather than anchors on the index,
          and worded for who is reading. A retreat host hiring a venue is
          taking on responsibility for their own participants, which is a
          different document from the guest health disclaimer. */}
      <p className="enquiry-fine">
        By enquiring you agree to our <a href="/legal/terms-and-conditions">Terms &amp; Conditions</a>{' '}
        and <a href="/legal/privacy-policy">Privacy Policy</a>.{' '}
        {marketplace === 'Wellness' ? (
          <>Wellness treatments carry conditions of their own, set out in the{' '}
            <a href="/legal/health-wellness-disclaimer">Health &amp; Wellness Disclaimer</a>.</>
        ) : (
          <>If you go on to hire this venue, you are responsible for the participants you
            bring. What that means is set out in the{' '}
            <a href="/legal/retreat-host-agreement">Retreat Host Agreement</a>.</>
        )}
      </p>
    </div>
  );
}
