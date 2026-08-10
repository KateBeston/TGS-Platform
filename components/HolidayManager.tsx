'use client';

import { useState, useTransition } from 'react';
import { addManualHoliday, syncHolidays } from '@/app/actions/scheduling';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

export default function HolidayManager({ rows }: { rows: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [manual, setManual] = useState({ code: '', date: '', name: '' });

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? 'Done.') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const sel: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '7px 9px', fontSize: 13,
  };
  const thisYear = new Date().getFullYear();

  return (
    <>
      <div className="note">
        <strong>Synced from Nager.Date</strong> — 200 countries, no key, no rate limit.</div>

      {msg && <div className="note">{msg}</div>}

      <div className="sect">
        <h3>Sync a year</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      marginBottom: 'var(--s4)' }}>
          <div className="f" style={{ maxWidth: 130 }}>
            <label htmlFor="yr">Year</label>
            <select id="yr" value={year} style={sel}
                    onChange={(e) => setYear(Number(e.target.value))}>
              {[thisYear, thisYear + 1, thisYear + 2].map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>Country</th><th>Venues</th><th>Loaded</th><th>Years</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="v-name">{c.name}</span>
                  <div className="v-slug">{c.iso_code}</div>
                </td>
                <td>{c.venues.toLocaleString('en-AU')}</td>
                <td>
                  {c.loaded
                    ? <>{c.loaded}{c.manual > 0 && (
                        <span className="v-slug"> · {c.manual} manual</span>)}</>
                    : <span className="pill empty">None</span>}
                </td>
                <td className="v-slug">{c.years.join(', ') || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="link-btn" disabled={pending}
                    onClick={() => act(() => syncHolidays(c.iso_code, year))}>
                    Sync {year}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sect">
        <h3>Add by hand</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          For lunar-calendar dates and anything Nager.Date does not cover
        </div>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      flexWrap: 'wrap' }}>
          <div className="f" style={{ maxWidth: 110 }}>
            <label>Country code</label>
            <input data-bwignore style={sel} value={manual.code} placeholder="ID"
              onChange={(e) => setManual({ ...manual, code: e.target.value.toUpperCase() })} />
          </div>
          <div className="f" style={{ maxWidth: 170 }}>
            <label>Date</label>
            <input type="date" data-bwignore style={sel} value={manual.date}
              onChange={(e) => setManual({ ...manual, date: e.target.value })} />
          </div>
          <div className="f" style={{ minWidth: 240, flex: 1 }}>
            <label>Name</label>
            <input data-bwignore style={sel} value={manual.name} placeholder="Eid al-Fitr"
              onChange={(e) => setManual({ ...manual, name: e.target.value })} />
          </div>
          <button className="btn" disabled={pending || !manual.code || !manual.date || !manual.name}
            onClick={() => act(async () => {
              const res = await addManualHoliday(manual.code, manual.date, manual.name);
              if (res.ok) setManual({ code: manual.code, date: '', name: '' });
              return res;
            })}>Add</button>
        </div>
      </div>
    </>
  );
}
