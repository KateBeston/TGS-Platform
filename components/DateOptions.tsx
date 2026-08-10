'use client';

import { useState, useTransition } from 'react';
import { addDateOption, removeDateOption, saveDateOption } from '@/app/actions/enquiries';
import DateConflictAlert from './DateConflictAlert';
import { useSaveState } from './SaveState';
import TimeSelect from './TimeSelect';

type Row = Record<string, any>;

/** Several possible windows, ranked. A venue rarely has the first choice
 *  free, and "are you flexible?" is the question that saves most enquiries
 *  — so the alternatives are captured once rather than rediscovered on
 *  every call. */
export default function DateOptions({
  enquiryId, options, countryCode, venueIds,
}: {
  enquiryId: number; options: Row[];
  countryCode?: string | null;
  venueIds?: number[];
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [list, setList] = useState(options);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  const sel = { background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                padding: '7px 9px', width: '100%', fontSize: 13 };

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Dates</h3>
          <div className="ph-sub">
            {list.length ? `${list.length} option${list.length === 1 ? '' : 's'}` : 'No dates yet'}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" disabled={pending}
            onClick={() => act(async () => {
              const res = await addDateOption(enquiryId);
              if (res.ok) setList([...list, { id: res.id, preference: list.length + 1 }]);
              return res;
            })}>Add an option</button>
        </div>
      </div>

      {!list.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          Add the preferred window, then any alternatives. Recording second and third choices up
          front is what turns "they cannot do March" into an offer rather than a dead end.
        </div>
      )}

      {list.map((o, i) => (
        <div className="row-card" key={o.id} style={{ marginBottom: 'var(--s3)' }}>
          <header>
            <div className="rt" style={{ fontSize: 17 }}>
              {i === 0 ? 'Preferred' : `Alternative ${i}`}
              {o.nights ? ` · ${o.nights} nights` : ''}
            </div>
            <button className="link-btn" disabled={pending}
              onClick={() => act(async () => {
                const res = await removeDateOption(o.id, enquiryId);
                if (res.ok) setList(list.filter((x) => x.id !== o.id));
                return res;
              })}>Remove</button>
          </header>

          <div className="grid">
            <div className="f">
              <label>Arrive</label>
              <input type="date" data-bwignore style={sel} defaultValue={o.date_from ?? ''}
                onBlur={(e) => e.target.value !== (o.date_from ?? '') &&
                  act(() => saveDateOption(o.id, enquiryId, 'date_from', e.target.value || null))} />
            </div>
            <div className="f">
              <label>Depart</label>
              <input type="date" data-bwignore style={sel} defaultValue={o.date_to ?? ''}
                onBlur={(e) => e.target.value !== (o.date_to ?? '') &&
                  act(() => saveDateOption(o.id, enquiryId, 'date_to', e.target.value || null))} />
            </div>
            <div className="f">
              <label>Arrival time</label>
              <TimeSelect value={o.arrival_time ?? null} placeholder="Any time"
                onChange={(v) => act(() =>
                  saveDateOption(o.id, enquiryId, 'arrival_time', v))} />
            </div>
            <div className="f">
              <label>Departure time</label>
              <TimeSelect value={o.departure_time ?? null} placeholder="Any time"
                onChange={(v) => act(() =>
                  saveDateOption(o.id, enquiryId, 'departure_time', v))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                        marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
            <button type="button" className={`pill ${o.is_flexible ? 'gold' : ''}`}
              style={{ cursor: 'pointer',
                       background: o.is_flexible ? undefined : 'var(--warm-white)' }}
              onClick={() => act(async () => {
                const next = !o.is_flexible;
                setList(list.map((x) => x.id === o.id ? { ...x, is_flexible: next } : x));
                return saveDateOption(o.id, enquiryId, 'is_flexible', next);
              })}>
              {o.is_flexible ? 'Flexible' : 'Fixed'}
            </button>
            {o.is_flexible && (
              <div className="f" style={{ maxWidth: 150 }}>
                <label>Give or take (days)</label>
                <input type="number" data-bwignore style={sel}
                  defaultValue={o.flexibility_days ?? ''}
                  onBlur={(e) => act(() => saveDateOption(o.id, enquiryId, 'flexibility_days',
                    e.target.value ? Number(e.target.value) : null))} />
              </div>
            )}
            <div className="f" style={{ flex: 1, minWidth: 200 }}>
              <label>Notes</label>
              <input data-bwignore style={sel} defaultValue={o.notes ?? ''}
                onBlur={(e) => e.target.value !== (o.notes ?? '') &&
                  act(() => saveDateOption(o.id, enquiryId, 'notes', e.target.value || null))} />
            </div>
          </div>

          <DateConflictAlert
            dateFrom={o.date_from ?? null} dateTo={o.date_to ?? null}
            countryCode={countryCode} venueIds={venueIds} />
        </div>
      ))}
    </div>
  );
}
