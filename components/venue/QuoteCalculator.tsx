'use client';

import { useState } from 'react';

/* The stay quote surface. Dates and guests in, an itemised quote out — the
 * arithmetic all happens in price_a_stay, which this only presents. A first,
 * honest number before anyone commits to anything; the booking flow proper
 * sits on top of this later. */

type Line = { what: string; detail?: string; amount: number; is_discount?: boolean; optional?: boolean };
type Quote = {
  error?: string; why?: string;
  venue?: string; nights?: number; guests?: number | null;
  rate_plan?: string; basis?: string; season?: string | null;
  lines?: Line[]; subtotal?: number; currency?: string;
  discount?: number | null; deposit?: number | null; deposit_basis?: string | null;
};

function money(amount: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: currency || 'AUD', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || 'AUD'} ${Math.round(amount)}`;
  }
}

export default function QuoteCalculator({ venueId }: { venueId: number }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [guests, setGuests] = useState('2');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const calculate = async () => {
    setMsg('');
    setQuote(null);
    if (!from || !to) { setMsg('Choose an arrival and a departure date.'); return; }
    if (to <= from) { setMsg('The departure has to be after the arrival.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, from, to, guests: guests ? Number(guests) : null }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data?.error ?? 'The quote could not be calculated.'); return; }
      setQuote(data.quote as Quote);
    } catch {
      setMsg('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="quote">
      <div className="quote-form">
        <label className="quote-field">
          <span>Arrival</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="quote-field">
          <span>Departure</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="quote-field">
          <span>Guests</span>
          <input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} />
        </label>
        <button className="quote-go" onClick={calculate} disabled={busy}>
          {busy ? 'Calculating…' : 'Estimate'}
        </button>
      </div>

      {msg && <p className="quote-msg">{msg}</p>}

      {quote && quote.error && (
        <div className="quote-result">
          <p className="quote-msg">{quote.error}</p>
          {quote.why && <p className="quote-why">{quote.why}</p>}
        </div>
      )}

      {quote && !quote.error && quote.lines && (
        <div className="quote-result">
          <div className="quote-head">
            {quote.nights} {quote.nights === 1 ? 'night' : 'nights'}
            {quote.guests ? `, ${quote.guests} ${quote.guests === 1 ? 'guest' : 'guests'}` : ''}
            {quote.season ? ` · ${quote.season}` : ''}
          </div>
          <ul className="quote-lines">
            {quote.lines.map((l, i) => (
              <li key={i} className={l.is_discount ? 'quote-line discount' : 'quote-line'}>
                <span className="quote-line-what">
                  {l.what}
                  {l.detail ? <span className="quote-line-detail">{l.detail}</span> : null}
                </span>
                <span className="quote-line-amt">{money(l.amount, quote.currency ?? null)}</span>
              </li>
            ))}
          </ul>
          <div className="quote-subtotal">
            <span>Estimated total</span>
            <span>{money(quote.subtotal ?? 0, quote.currency ?? null)}</span>
          </div>
          {quote.deposit != null && (
            <div className="quote-deposit">
              <span>Deposit to reserve{quote.deposit_basis ? ` (${quote.deposit_basis.toLowerCase()})` : ''}</span>
              <span>{money(quote.deposit, quote.currency ?? null)}</span>
            </div>
          )}
          <p className="quote-note">
            An estimate based on the rates loaded for this venue. Final pricing is confirmed on booking.
          </p>
        </div>
      )}
    </div>
  );
}
