'use client';

import { useEffect, useState, useTransition } from 'react';
import { mergeComparison, mergeSelective, type FieldDiff } from '@/app/actions/duplicates';
import { useSaveState } from './SaveState';

/* ═══════════════════════════════════════════════════════════════════════
   MERGING FIELD BY FIELD

   Only what has to be decided is shown. A field the two records agree on,
   or that is empty on both, is not a decision — and a list of two hundred
   rows where four matter is a list nobody reads.

   Two kinds of decision, and they start differently:

     Only on the other record — filling a blank is nearly always right, so
     it is ticked.

     They disagree — replacing something somebody may have checked is a
     judgement, so it is not.
   ═══════════════════════════════════════════════════════════════════════ */

const LABELS: Record<string, string> = {
  venue_name: 'Name', website_url: 'Website', contact_email: 'Email',
  contact_phone: 'Phone', street_address: 'Address', postcode: 'Postcode',
  max_guests: 'Maximum guests', total_bedrooms: 'Bedrooms',
  total_bathrooms: 'Bathrooms', venue_short_description: 'Short description',
  venue_full_description: 'Full description', price_from: 'From price',
  venue_type_id: 'Venue type', city_id: 'City', country_id: 'Country',
  venue_code: 'Venue code', legacy_venue_id: 'Legacy ID',
  venue_category: 'Category',
};

const label = (col: string) =>
  LABELS[col] ?? col.replace(/_id$/, '').replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

export default function MergeModal({
  keepId, keepName, mergeId, mergeName, onDone, onCancel,
}: {
  keepId: number; keepName: string;
  mergeId: number; mergeName: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [diffs, setDiffs] = useState<FieldDiff[] | null>(null);
  const [take, setTake] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('Merged duplicate');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    start(async () => {
      const d = await mergeComparison(keepId, mergeId);
      setDiffs(d);
      // Blanks ticked, disagreements not.
      setTake(new Set(
        d.filter((f) => f.default_action === 'Take it').map((f) => f.column_name)));
    });
  }, [keepId, mergeId]);

  const toggle = (col: string) => {
    const next = new Set(take);
    next.has(col) ? next.delete(col) : next.add(col);
    setTake(next);
  };

  const blanks = (diffs ?? []).filter((f) => !f.keep_value);
  const clashes = (diffs ?? []).filter((f) => f.keep_value);

  const row = (f: FieldDiff) => {
    const on = take.has(f.column_name);
    return (
      <tr key={f.column_name} style={{ opacity: on ? 1 : 0.55 }}>
        <td style={{ width: 34 }}>
          <input type="checkbox" checked={on} data-bwignore
            onChange={() => toggle(f.column_name)} style={{ cursor: 'pointer' }} />
        </td>
        <td style={{ width: 170 }}>
          <span className="v-name" style={{ fontSize: 14 }}>{label(f.column_name)}</span>
        </td>
        <td style={{ maxWidth: 230, wordBreak: 'break-word' }}>
          <div className="v-slug" style={{ fontSize: 9, letterSpacing: '.1em',
                                           textTransform: 'uppercase' }}>Keeping</div>
          <div style={{ fontSize: 12.5, textDecoration: on && f.keep_value
            ? 'line-through' : undefined, color: on && f.keep_value
            ? 'var(--muted)' : undefined }}>
            {f.keep_value ?? <span style={{ color: 'var(--muted)' }}>empty</span>}
          </div>
        </td>
        <td style={{ maxWidth: 230, wordBreak: 'break-word' }}>
          <div className="v-slug" style={{ fontSize: 9, letterSpacing: '.1em',
                                           textTransform: 'uppercase' }}>From the other</div>
          <div style={{ fontSize: 12.5, fontWeight: on ? 500 : 400 }}>
            {f.merge_value}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(49,49,49,.45)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 'var(--s6) var(--s4)', zIndex: 60, overflowY: 'auto',
    }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background: 'var(--warm-white)', border: '1px solid var(--border)',
        maxWidth: 860, width: '100%', padding: 'var(--s6)',
      }}>
        <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
          <div>
            <h2 style={{ fontSize: 26 }}>Merge into {keepName}</h2>
            <div className="ph-sub">
              {mergeName} will be removed once anything worth keeping has been taken
            </div>
          </div>
          <div className="ph-act">
            <button className="link-btn" onClick={onCancel}>Cancel</button>
          </div>
        </div>

        {!diffs && <div className="v-slug">Comparing…</div>}

        {diffs && !diffs.length && (
          <div className="note">
            <strong>Nothing to decide.</strong> The other record holds nothing this one does not.
            Merging will move any rooms, spaces and services across and remove it.
          </div>
        )}

        {!!blanks.length && (
          <div className="sect">
            <h3>Only on the other record</h3>
            <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
              Ticked by default — filling a blank is nearly always right
            </div>
            <table><tbody>{blanks.map(row)}</tbody></table>
          </div>
        )}

        {!!clashes.length && (
          <div className="sect">
            <h3>They disagree</h3>
            <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
              Not ticked — replacing a value somebody may have checked is a judgement
            </div>
            <table><tbody>{clashes.map(row)}</tbody></table>
          </div>
        )}

        <div className="f" style={{ marginTop: 'var(--s4)' }}>
          <label>Why</label>
          <input data-bwignore value={reason}
            style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                     padding: '7px 9px', width: '100%', fontSize: 13 }}
            onChange={(e) => setReason(e.target.value)} />
          <span className="help">
            The surviving record is kept in the audit log as it was, so a merge can be unpicked
          </span>
        </div>

        {msg && <div className="note bad" style={{ marginTop: 'var(--s4)' }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                      marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
          <button className="btn" disabled={pending || !diffs}
            onClick={() => start(async () => {
              report('saving');
              const res = await mergeSelective(
                keepId, mergeId, Array.from(take), reason);
              if (res.ok) { onDone(res.message ?? 'Merged.'); return; }
              setMsg((res as any).error);
              report('error');
            })}>
            {pending ? 'Merging…'
              : take.size
                ? `Take ${take.size} and merge`
                : 'Merge without taking anything'}
          </button>
          <button className="btn quiet" onClick={onCancel}>Cancel</button>
          <span className="help" style={{ margin: 0 }}>
            Rooms, spaces, services and enquiries move across either way
          </span>
        </div>
      </div>
    </div>
  );
}
