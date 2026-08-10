'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { notDuplicates, runSweep } from '@/app/actions/duplicates';
import MergeModal from './MergeModal';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const TABS = [
  { key: 'Open', label: 'To decide' },
  { key: 'Merged', label: 'Merged' },
  { key: 'Not duplicates', label: 'Not duplicates' },
];

/* ═══════════════════════════════════════════════════════════════════════
   POSSIBLE DUPLICATES

   Two records for one venue means two sets of enquiries, two commission
   arrangements, and a host booking whichever one nobody updated.

   Merging is not reversible, so the two are shown side by side with what
   each holds. The fuller record is suggested as the survivor — but only
   suggested, because "fuller" and "correct" are not the same thing.
   ═══════════════════════════════════════════════════════════════════════ */

export default function DuplicateReview({
  pairs, counts, status,
}: { pairs: Row[]; counts: Record<string, number>; status: string }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [merging, setMerging] = useState<{
    keepId: number; keepName: string; mergeId: number; mergeName: string;
  } | null>(null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res?.ok === false ? res.error : (res?.message ?? ''));
    report(res?.ok === false ? 'error' : 'saved');
  });

  const side = (v: Row | null, isKeeper: boolean, filled: number) => {
    if (!v) return <div className="v-slug">Record no longer exists</div>;
    return (
      <div style={{
        border: `1px solid ${isKeeper ? 'var(--gold)' : 'var(--border)'}`,
        padding: 'var(--s4)',
        background: isKeeper ? 'var(--warm-cream)' : undefined,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'baseline', gap: 'var(--s3)' }}>
          <Link href={`/venues/${v.id}/details`} style={{ textDecoration: 'none' }}>
            <span className="v-name" style={{ fontSize: 17 }}>{v.venue_name}</span>
          </Link>
          <span className="v-slug">#{v.id}</span>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 3 }}>
          <span className="pill empty">{v.venue_status}</span>
          {' '}{filled} of 7 details filled
          {' · added '}{new Date(v.created_at).toLocaleDateString('en-AU',
            { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr',
                     gap: '3px var(--s3)', margin: 'var(--s3) 0 0', fontSize: 12.5 }}>
          {([
            ['Website', v.website_url],
            ['Email', v.contact_email],
            ['Phone', v.contact_phone],
            ['Address', v.street_address],
            ['Where', [v.cities?.name, v.countries?.name].filter(Boolean).join(', ')],
            ['Sleeps', v.max_guests],
            ['Bedrooms', v.total_bedrooms],
          ] as [string, any][]).map(([label, value]) => (
            <div key={label} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--ink-quiet)', fontSize: 11 }}>{label}</dt>
              <dd style={{ margin: 0, wordBreak: 'break-word' }}>
                {value || <span style={{ color: 'var(--muted)' }}>—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  return (
    <>
      <div className="ph">
        <div>
          <h2>Possible duplicates</h2>
          <div className="ph-sub">
            {counts.Open ?? 0} to decide
            {counts.Merged ? ` · ${counts.Merged} merged` : ''}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" disabled={pending}
            onClick={() => act(runSweep)}>
            {pending ? 'Scanning…' : 'Scan again'}
          </button>
        </div>
      </div>

      <div className="note">
        <strong>Two records for one venue is not a tidiness problem.</strong> It means two sets of
        enquiries, two commission arrangements, and a host booking whichever one nobody updated.</div>

      <div className="note">
        <strong>A shared website is not enough on its own.</strong></div>

      <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap',
                    marginBottom: 'var(--s5)' }}>
        {TABS.map((t) => (
          <Link key={t.key}
                className={`btn ${status === t.key ? '' : 'quiet'}`}
                href={`/venues/duplicates?status=${encodeURIComponent(t.key)}`}>
            {t.label}{counts[t.key] ? ` · ${counts[t.key]}` : ''}
          </Link>
        ))}
      </div>

      {msg && <div className="note">{msg}</div>}

      {!pairs.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          {status === 'Open'
            ? 'Nothing waiting. Run a scan to check for pairs sharing a website, an email, or almost the same name.'
            : 'Nothing in this state.'}
        </div>
      )}

      {merging && (
        <MergeModal
          {...merging}
          onCancel={() => setMerging(null)}
          onDone={(m) => { setMerging(null); setMsg(m); }}
        />
      )}

      {pairs.map((p) => {
        const keepA = p.suggestKeep === p.venue_id;

        return (
          <div className="sect" key={p.id}>
            <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
              <div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(p.signals ?? []).map((s: string) => (
                    <span key={s} className={`pill ${s === 'Same website' ? 'gold' : 'empty'}`}>
                      {s}
                    </span>
                  ))}
                </div>
                <div className="ph-sub" style={{ marginTop: 5 }}>
                  {p.name_similarity != null
                    && `Names ${Math.round(Number(p.name_similarity) * 100)}% alike · `}
                  confidence {Math.round(Number(p.score) * 100)}%
                </div>
              </div>
              {status === 'Open' && (
                <div className="ph-act">
                  <button className="link-btn" disabled={pending}
                    onClick={() => act(() => notDuplicates(p.id))}>
                    Different venues
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                          gap: 'var(--s4)' }}>
              {side(p.a, keepA, p.aFilled)}
              {side(p.b, !keepA, p.bFilled)}
            </div>

            {status === 'Open' && p.a && p.b && (
              <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s4)',
                            flexWrap: 'wrap', alignItems: 'center' }}>
                {[[p.venue_id, p.other_venue_id, p.a, p.b],
                  [p.other_venue_id, p.venue_id, p.b, p.a]].map(
                  ([keep, merge, keepV, mergeV]: any) => (
                    <button key={keep}
                      className={`btn ${p.suggestKeep === keep ? '' : 'quiet'}`}
                      disabled={pending}
                      onClick={() => setMerging({
                        keepId: keep, keepName: keepV.venue_name,
                        mergeId: merge, mergeName: mergeV.venue_name,
                      })}>
                      Keep {keepV.venue_name}
                    </button>
                  ))}
                <span className="help" style={{ margin: 0 }}>
                  The fuller record is suggested — you choose field by field next
                </span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
