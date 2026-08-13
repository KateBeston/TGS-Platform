'use client';

import { useState } from 'react';

/* The concierge enquiry on the Wellness Experiences page, for when the
 * practice someone is seeking is not in the collection yet. Posts to the
 * same /api/enquiry endpoint as every other form, persisting first, with
 * the honeypot the API already checks. Marked as a Wellness Guest enquiry.
 * Deliberately short: a name, an email, and what they are seeking. */

export default function PracticeEnquiry() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [trap, setTrap] = useState('');
  const [f, setF] = useState({ firstName: '', email: '', notes: '' });

  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const submit = async () => {
    if (busy) return;
    if (!f.email.trim() || !f.firstName.trim()) {
      setProblem('A name and an email, and we can take it from there.');
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, marketplace: 'Wellness', website: trap }),
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
          Your enquiry is with the concierge. We read every one ourselves and will come back to
          you within a day with a personal selection.
        </p>
      </div>
    );
  }

  return (
    <div className="enquiry">
      <div className="trap" aria-hidden="true">
        <label htmlFor="p-site">Website</label>
        <input
          id="p-site"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>

      <div className="enquiry-grid">
        <div className="f">
          <label htmlFor="p-first">First name</label>
          <input id="p-first" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="p-email">Email</label>
          <input id="p-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </div>
      </div>

      <div className="f">
        <label htmlFor="p-notes">The practice or experience you are seeking</label>
        <textarea
          id="p-notes"
          rows={3}
          value={f.notes}
          placeholder="Tell us the modality, style or experience you have in mind"
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      {problem && <p className="enquiry-problem">{problem}</p>}

      <button type="button" className="btn-solid" onClick={submit} disabled={busy}>
        {busy ? 'Sending' : 'Send to the concierge'}
      </button>

      <p className="enquiry-fine">
        By enquiring you agree to our <a href="/legal#terms-and-conditions">terms</a> and{' '}
        <a href="/legal#privacy-policy">privacy policy</a>. The concierge is free to you.
      </p>
    </div>
  );
}
