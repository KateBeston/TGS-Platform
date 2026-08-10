'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveVenue, restoreVenue } from '@/app/actions/venues';
import MergeModal from './MergeModal';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   ARCHIVE AND MERGE

   Archiving rather than deleting, deliberately. "Why did this disappear"
   is a question asked a year later, and a deleted row cannot answer it.

   The reason is required. An archive with no reason is a venue that
   vanished, which is the thing being avoided.

   Merging sits alongside it because the two are often confused: a
   duplicate should be MERGED, not archived. Archiving a duplicate strands
   whatever pointed at it; merging carries it across.
   ═══════════════════════════════════════════════════════════════════════ */

export default function VenueArchive({
  venue, reasons, impact, similar, history,
}: {
  venue: Row; reasons: Row[]; impact: any; similar: Row[]; history: Row[];
}) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [reasonId, setReasonId] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState<Row | null>(null);
  const [msg, setMsg] = useState('');

  const chosen = reasons.find((r) => r.id === reasonId);
  const isArchived = !!venue.archived_at;
  const strong = similar.filter((s) => Number(s.score) >= 0.45);

  const sel: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '8px 10px', width: '100%', fontSize: 13.5,
  };

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href={`/venues/${venue.id}/details`}>{venue.venue_name}</Link> · Archive
      </div>

      {merging && (
        <MergeModal
          keepId={venue.id} keepName={venue.venue_name}
          mergeId={merging.venue_id} mergeName={merging.venue_name}
          onCancel={() => setMerging(null)}
          onDone={(m) => { setMerging(null); setMsg(m); router.refresh(); }}
        />
      )}

      <div className="ph">
        <div>
          <h2>Archive</h2>
          <div className="ph-sub">
            {isArchived
              ? `Archived — ${venue.archived_reason}`
              : 'Out of every list, kept in the record'}
          </div>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {/* ── merge first, because a duplicate should never be archived ── */}
      {!!strong.length && !isArchived && (
        <div className="sect">
          <h3>This may be a duplicate</h3>
          <div className="note">
            <strong>A duplicate should be merged, not archived.</strong> Archiving one strands
            whatever pointed at it — enquiries, rooms, services. Merging carries all of it across
            and then removes the other record.
          </div>
          <table>
            <thead><tr><th>Venue</th><th>Why it matched</th><th>Where</th><th></th></tr></thead>
            <tbody>
              {strong.map((s) => (
                <tr key={s.venue_id}>
                  <td>
                    <Link href={`/venues/${s.venue_id}/details`}
                          style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 16 }}>{s.venue_name}</span>
                    </Link>
                    <div className="v-slug">
                      {s.venue_status}
                      {s.website_url && ` · ${s.website_url.replace(/^https?:\/\/(www\.)?/, '')}`}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(s.signals ?? []).map((x: string) => (
                        <span key={x} className={`pill ${x === 'Same website' ? 'gold' : 'empty'}`}
                              style={{ fontSize: 9 }}>{x}</span>
                      ))}
                    </div>
                    <div className="v-slug" style={{ marginTop: 3 }}>
                      {Math.round(Number(s.score) * 100)}% confidence
                    </div>
                  </td>
                  <td className="v-slug">
                    {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn quiet" onClick={() => setMerging(s)}>
                      Merge into this one
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── archiving ─────────────────────────────────────────────── */}
      {isArchived ? (
        <div className="sect">
          <h3>Currently archived</h3>
          <dl className="doc-dl">
            <dt>Reason</dt><dd>{venue.archived_reason}</dd>
            <dt>When</dt>
            <dd>{new Date(venue.archived_at).toLocaleDateString('en-AU',
              { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
            {venue.archived_by && (<><dt>By</dt><dd>{venue.archived_by}</dd></>)}
          </dl>
          <button className="btn" disabled={pending}
            style={{ marginTop: 'var(--s4)' }}
            onClick={() => start(async () => {
              report('saving');
              const res = await restoreVenue(venue.id);
              setMsg(res.ok ? res.message : res.error);
              report(res.ok ? 'saved' : 'error');
              if (res.ok) router.refresh();
            })}>
            Bring it back into the list
          </button>
        </div>
      ) : (
        <div className="sect">
          <h3>Archive this venue</h3>

          <div className="note">
            It leaves every list and every search, and stays in the record. Enquiries, rooms and
            services keep pointing at it — nothing is destroyed.
            {impact?.total > 0 && (
              <> This venue has <strong>{impact.total} attached record
              {impact.total === 1 ? '' : 's'}</strong>, which is another reason not to delete it.</>
            )}
          </div>

          <div className="grid">
            <div className="f">
              <label>Why</label>
              <select value={reasonId} style={sel}
                onChange={(e) => setReasonId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Choose a reason</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {chosen?.description && (
                <span className="help">{chosen.description}</span>
              )}
            </div>
            <div className="f">
              <label>Further detail</label>
              <input data-bwignore value={note} style={sel}
                placeholder={chosen?.slug === 'other'
                  ? 'Required — say what happened'
                  : 'Optional'}
                onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          {chosen?.slug === 'duplicate' && (
            <div className="note bad">
              <strong>Merge instead.</strong> Archiving a duplicate leaves two records and strands
              whatever pointed at the one being hidden. Merging moves it across first.
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                        marginTop: 'var(--s4)', flexWrap: 'wrap' }}>
            <button className="btn"
              disabled={pending || !reasonId
                || (chosen?.slug === 'other' && !note.trim())}
              onClick={() => {
                if (!confirming) { setConfirming(true); return; }
                start(async () => {
                  report('saving');
                  const res = await archiveVenue(venue.id, Number(reasonId), note);
                  setMsg(res.ok ? res.message : res.error);
                  report(res.ok ? 'saved' : 'error');
                  setConfirming(false);
                  if (res.ok) router.push('/venues');
                });
              }}>
              {confirming
                ? `Confirm — archive ${venue.venue_name}`
                : 'Archive this venue'}
            </button>
            {confirming && (
              <button className="btn quiet" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            )}
            <span className="help" style={{ margin: 0 }}>
              {confirming
                ? 'It can be brought back at any time'
                : chosen?.is_permanent === false
                  ? 'This reason suggests it may come back'
                  : ''}
            </span>
          </div>
        </div>
      )}

      {!!history.length && (
        <div className="sect">
          <h3>What has happened to this record</h3>
          <table>
            <thead><tr><th>When</th><th>What</th><th>Why</th><th>Who</th></tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td className="v-slug">
                    {new Date(h.changed_at).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td><span className="pill empty">{h.operation}</span></td>
                  <td className="v-slug" style={{ maxWidth: 340 }}>{h.reason}</td>
                  <td className="v-slug">{h.changed_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div></div>
  );
}
