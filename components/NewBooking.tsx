'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  createBooking, templatesFor, venuesToBook,
} from '@/app/actions/manualPayments';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   A BOOKING MADE BY HAND

   For a stay arranged by phone or email, which during the concierge
   period is all of them.

   The same record a booking made on the site produces — one shape, so
   nothing downstream has to know which door it came through. The
   commission rate and the venue's cancellation terms are captured as they
   stand, because both are facts about the moment it was agreed.
   ═══════════════════════════════════════════════════════════════════════ */

export default function NewBooking({ hostTypes }: { hostTypes: Row[] }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();

  const [venueSearch, setVenueSearch] = useState('');
  const [venues, setVenues] = useState<Row[]>([]);
  const [venue, setVenue] = useState<Row | null>(null);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');

  const [f, setF] = useState({
    bookedByType: 'Retreat Host',
    guestName: '', guestEmail: '', guestPhone: '',
    hostTypeId: '',
    dateFrom: '', dateTo: '',
    guestCount: '', isExclusiveUse: false,
    whatFor: '', total: '', currency: 'AUD',
    templateId: '', note: '',
  });

  useEffect(() => {
    const t = setTimeout(() => { venuesToBook(venueSearch).then(setVenues); }, 250);
    return () => clearTimeout(t);
  }, [venueSearch]);

  useEffect(() => {
    if (venue) {
      templatesFor(venue.id).then(setTemplates);
      if (venue.price_currency) setF((x) => ({ ...x, currency: venue.price_currency }));
    }
  }, [venue]);

  const nights = f.dateFrom && f.dateTo
    ? Math.round((new Date(f.dateTo).getTime() - new Date(f.dateFrom).getTime()) / 86_400_000)
    : null;

  return (
    <div className="sect">
      <h3>A new booking</h3>
      <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
        For a stay arranged by phone or email
      </div>

      {msg && <div className="note">{msg}</div>}

      {!venue ? (
        <>
          <div className="f">
            <label htmlFor="vs">Which venue</label>
            <input id="vs" data-bwignore style={sel} value={venueSearch}
              placeholder="Search by name"
              onChange={(e) => setVenueSearch(e.target.value)} />
          </div>
          <table>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 14 }}>{v.venue_name}</span>
                    <div className="v-slug">
                      {[v.cities?.name, v.countries?.name].filter(Boolean).join(', ')}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link-btn" onClick={() => setVenue(v)}>Choose</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <div className="note">
            <strong>{venue.venue_name}</strong>
            <button className="link-btn" style={{ marginLeft: 12 }}
              onClick={() => setVenue(null)}>Change</button>
          </div>

          <div className="grid">
            <div className="f">
              <label htmlFor="who">Who is booking</label>
              <select id="who" style={sel} value={f.bookedByType}
                onChange={(e) => setF({ ...f, bookedByType: e.target.value })}>
                <option>Retreat Host</option>
                <option>Wellness Guest</option>
                <option>Participant</option>
              </select>
            </div>

            <div className="f">
              <label htmlFor="hostType">What they are</label>
              <select id="hostType" style={sel} value={f.hostTypeId}
                onChange={(e) => setF({ ...f, hostTypeId: e.target.value })}>
                <option value="">Not asked</option>
                {hostTypes.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <span className="help">
                The same question the enquiry asks, so a booking counts alongside the demand
                that produced it.
              </span>
            </div>

            <div className="f">
              <label htmlFor="gn">Their name</label>
              <input id="gn" data-bwignore style={sel} value={f.guestName}
                onChange={(e) => setF({ ...f, guestName: e.target.value })} />
            </div>

            <div className="f">
              <label htmlFor="ge">Their email</label>
              <input id="ge" data-bwignore style={sel} value={f.guestEmail}
                onChange={(e) => setF({ ...f, guestEmail: e.target.value })} />
            </div>

            <div className="f">
              <label htmlFor="df">Arriving</label>
              <input id="df" type="date" data-bwignore style={sel} value={f.dateFrom}
                onChange={(e) => setF({ ...f, dateFrom: e.target.value })} />
            </div>

            <div className="f">
              <label htmlFor="dt">Leaving</label>
              <input id="dt" type="date" data-bwignore style={sel} value={f.dateTo}
                onChange={(e) => setF({ ...f, dateTo: e.target.value })} />
              {nights !== null && (
                <span className="help">{nights} night{nights === 1 ? '' : 's'}</span>
              )}
            </div>

            <div className="f">
              <label htmlFor="gc">How many people</label>
              <input id="gc" type="number" data-bwignore style={sel} value={f.guestCount}
                onChange={(e) => setF({ ...f, guestCount: e.target.value })} />
            </div>

            <div className="f">
              <label htmlFor="tot">Total</label>
              <input id="tot" type="number" data-bwignore style={sel} value={f.total}
                onChange={(e) => setF({ ...f, total: e.target.value })} />
            </div>

            <div className="f">
              <label htmlFor="cur">Currency</label>
              <input id="cur" data-bwignore style={sel} value={f.currency}
                onChange={(e) => setF({ ...f, currency: e.target.value })} />
            </div>

            <div className="f">
              <label htmlFor="tpl">Payment plan</label>
              <select id="tpl" style={sel} value={f.templateId}
                onChange={(e) => setF({ ...f, templateId: e.target.value })}>
                <option value="">The venue&rsquo;s usual</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.venue_id ? ' · theirs' : ''}
                  </option>
                ))}
              </select>
              <span className="help">
                The instalments are built from this. It can be changed per host afterwards.
              </span>
            </div>

            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="wf">What it is for</label>
              <input id="wf" data-bwignore style={sel} value={f.whatFor}
                placeholder="Yoga retreat"
                onChange={(e) => setF({ ...f, whatFor: e.target.value })} />
            </div>

            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8,
                              cursor: 'pointer' }}>
                <input type="checkbox" data-bwignore checked={f.isExclusiveUse}
                  onChange={(e) => setF({ ...f, isExclusiveUse: e.target.checked })} />
                Exclusive use of the venue
              </label>
            </div>

            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="note">Anything worth recording</label>
              <input id="note" data-bwignore style={sel} value={f.note}
                onChange={(e) => setF({ ...f, note: e.target.value })} />
            </div>
          </div>

          <button className="btn" disabled={pending || !f.dateFrom || !f.dateTo || !f.total}
            style={{ marginTop: 'var(--s3)' }}
            onClick={() => start(async () => {
              report('saving');
              const r = await createBooking({
                venueId: venue.id,
                bookedByType: f.bookedByType,
                guestName: f.guestName || undefined,
                guestEmail: f.guestEmail || undefined,
                guestPhone: f.guestPhone || undefined,
                hostTypeId: f.hostTypeId ? Number(f.hostTypeId) : null,
                dateFrom: f.dateFrom,
                dateTo: f.dateTo,
                guestCount: f.guestCount ? Number(f.guestCount) : null,
                isExclusiveUse: f.isExclusiveUse,
                whatFor: f.whatFor || undefined,
                total: Number(f.total),
                currency: f.currency,
                templateId: f.templateId ? Number(f.templateId) : null,
                note: f.note || undefined,
              });
              setMsg(r.ok ? (r.message ?? '') : (r as any).error);
              report(r.ok ? 'saved' : 'error');
              if (r.ok) router.refresh();
            })}>
            Create the booking
          </button>

          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            The commission rate and the venue&rsquo;s cancellation terms are captured as they stand
            now, because both are facts about the moment it was agreed. The dates are held so
            nobody is offered them while this stands.
          </div>
        </>
      )}
    </div>
  );
}
