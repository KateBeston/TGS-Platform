'use client';

import { useState } from 'react';
import { firstTouch } from '@/lib/attribution';

/* The contact form.
 *
 * Structured where it can be. "I am a" decides what happens to the
 * enquiry — a venue owner goes somewhere different from a wellness
 * guest — and a form that leaves that to a paragraph makes somebody read
 * every message to sort them.
 *
 * The lead source is asked and also inferred, because the two disagree
 * often. Somebody who says "a friend" arrived on a Google ad, and both
 * facts are worth having.
 */

const ROLES = [
  ['Wellness Guest', 'I am looking for somewhere to go'],
  ['Retreat Host', 'I am looking for a venue to run something'],
  ['Venue Owner', 'I have a venue'],
  ['Press', 'Press or media'],
  ['Other', 'Something else'],
];

export default function ContactForm({
  sources,
}: { sources: { name: string; slug: string }[] }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [trap, setTrap] = useState('');

  const [f, setF] = useState({
    firstName: '', surname: '', email: '', phone: '',
    role: '', subject: '', message: '',
    leadSource: '', leadSourceOther: '',
  });

  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const submit = async () => {
    if (busy) return;
    if (!f.firstName.trim() || !f.email.trim() || !f.message.trim()) {
      setProblem('A name, an email and a message, and we can take it from there.');
      return;
    }
    setBusy(true); setProblem('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The first touch travels with it. Written once when they
        // arrived, so a second visit does not overwrite a first.
        body: JSON.stringify({ ...f, website: trap, attribution: firstTouch() }),
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
      <div className="apply-done">
        <div className="section-label">Sent</div>
        <h2 className="section-title">Thank you</h2>
        <p>
          We have your message and will come back within a day or two. If it is
          urgent, reply to the acknowledgement and say so.
        </p>
      </div>
    );
  }

  return (
    <div className="apply" style={{ maxWidth: 720 }}>
      <div className="trap" aria-hidden="true">
        <label htmlFor="c-site">Website</label>
        <input id="c-site" tabIndex={-1} autoComplete="off"
          value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>

      <div className="apply-grid">
        <div className="f">
          <label htmlFor="c-first">First name</label>
          <input id="c-first" value={f.firstName}
            onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="c-last">Surname</label>
          <input id="c-last" value={f.surname}
            onChange={(e) => set('surname', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" type="email" value={f.email}
            onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="c-phone">Phone</label>
          <input id="c-phone" value={f.phone}
            onChange={(e) => set('phone', e.target.value)} />
        </div>

        <div className="f f-wide">
          <label>I am</label>
          <div className="tick-row">
            {ROLES.map(([value, label]) => (
              <label key={value} className={`tick ${f.role === value ? 'is-on' : ''}`}>
                <input type="radio" name="role" checked={f.role === value}
                  onChange={() => set('role', value)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="f f-wide">
          <label htmlFor="c-subject">What it is about</label>
          <input id="c-subject" value={f.subject}
            onChange={(e) => set('subject', e.target.value)} />
        </div>

        <div className="f f-wide">
          <label htmlFor="c-message">Your message</label>
          <textarea id="c-message" rows={6} value={f.message}
            onChange={(e) => set('message', e.target.value)} />
        </div>

        <div className="f f-wide">
          <label htmlFor="c-source">How did you hear about us</label>
          <select id="c-source" value={f.leadSource}
            onChange={(e) => set('leadSource', e.target.value)}>
            <option value="">Rather not say</option>
            {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>

        {f.leadSource === 'other' && (
          <div className="f f-wide">
            <label htmlFor="c-source-other">Where?</label>
            <input id="c-source-other" value={f.leadSourceOther}
              onChange={(e) => set('leadSourceOther', e.target.value)} />
          </div>
        )}
      </div>

      {problem && <p className="enquiry-problem">{problem}</p>}

      <div className="apply-actions">
        <button type="button" className="btn-solid" disabled={busy} onClick={submit}>
          {busy ? 'Sending' : 'Send the message'}
        </button>
      </div>

      <p className="enquiry-fine">
        We answer within a day or two. Your details are handled as described in our{' '}
        <a href="/legal#privacy">privacy policy</a>.
      </p>
    </div>
  );
}
