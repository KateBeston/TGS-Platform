'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { aiBatch } from '@/app/actions/aiHarvest';
import { acceptAllSafe, batchHarvest, decideProposal } from '@/app/actions/harvest';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const LABELS: Record<string, string> = {
  venue_name: 'Venue name',
  venue_short_description: 'Short description',
  street_address: 'Street address',
  postcode: 'Postcode',
  latitude: 'Latitude',
  longitude: 'Longitude',
  contact_phone: 'Phone',
  contact_email: 'Email',
  primary_image_url: 'Primary image',
  instagram_url: 'Instagram',
  facebook_url: 'Facebook',
  linkedin_url: 'LinkedIn',
};

export default function HarvestQueue({
  runs, proposals, remaining, aiRemaining, spend,
}: {
  runs: Row[]; proposals: Row[]; remaining: number;
  aiRemaining: number; spend: Row | null;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [batch, setBatch] = useState(25);
  const [aiSize, setAiSize] = useState(10);
  const [open, setOpen] = useState<number | null>(runs[0]?.id ?? null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? 'Done.') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const byRun = new Map<number, Row[]>();
  proposals.forEach((p) => {
    const list = byRun.get(p.run_id) ?? [];
    list.push(p); byRun.set(p.run_id, list);
  });

  return (
    <>
      <div className="sect">
        <h3>Read the next batch</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end' }}>
          <div className="f" style={{ maxWidth: 140 }}>
            <label htmlFor="n">Sites to read</label>
            <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="n" value={batch} onChange={(e) => setBatch(Number(e.target.value))}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }}>
              {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn" disabled={pending || !remaining}
                  onClick={() => act(() => batchHarvest(batch))}>
            {pending ? 'Reading…' : 'Read next batch'}
          </button>
        </div>
        <div className="note" style={{ marginTop: 'var(--s4)' }}>
          Five sites are read at a time. Consecutive venues are different domains, so nothing is
          hit twice — the earlier one-per-second pacing protected nobody and made this a twenty
          minute wait.</div>
        {msg && <div className="note" style={{ marginTop: 'var(--s3)' }}>{msg}</div>}
      </div>

      <div className="sect">
        <h3>Read with Claude</h3>
        <div className="note">
          <strong>The second pass.</strong> The harvest above reads what a page states about
          itself in machine-readable form.</div>

        {spend && (
          <div className="stats" style={{ marginBottom: 'var(--s4)' }}>
            <div className="stat">
              <div className="v" style={{ fontSize: 26 }}>${Number(spend.spent_usd ?? 0).toFixed(2)}</div>
              <div className="l">Spent so far</div>
            </div>
            <div className="stat">
              <div className="v" style={{ fontSize: 26 }}>{spend.completed ?? 0}</div>
              <div className="l">Venues read</div>
            </div>
            <div className="stat">
              <div className="v" style={{ fontSize: 26 }}>
                ${Number(spend.avg_per_venue ?? 0).toFixed(4)}
              </div>
              <div className="l">Average each</div>
            </div>
            <div className="stat">
              <div className="v" style={{ fontSize: 26 }}>
                ${Number(spend.projected_remaining_usd ?? 0).toFixed(2)}
              </div>
              <div className="l">To finish the rest</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end' }}>
          <div className="f" style={{ maxWidth: 140 }}>
            <label htmlFor="ai">Venues to read</label>
            <select id="ai" value={aiSize} onChange={(e) => setAiSize(Number(e.target.value))}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }}>
              {[5, 10, 25].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn" disabled={pending || !aiRemaining}
                  onClick={() => act(() => aiBatch(aiSize))}>
            {pending ? 'Reading…' : 'Read next batch'}
          </button>
          <Link className="btn quiet" href="/venues/harvest/coverage">
            What the web does not say
          </Link>
          <Link className="btn quiet" href="/venues/harvest/fields">
            Fields
          </Link>
          <span className="help" style={{ alignSelf: 'center', margin: 0 }}>
            {aiRemaining.toLocaleString('en-AU')} not yet read
          </span>
        </div>
      </div>

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Review</h3>
            <div className="ph-sub">One venue at a time</div>
          </div>
          <div className="ph-act">
            <Link className="btn" href="/venues/harvest/review">Review by field</Link>
          </div>
        </div>

        {!runs.length && <div className="note">No sites read yet.</div>}

        <div className="rows">
          {runs.map((r) => {
            const props = byRun.get(r.id) ?? [];
            const isOpen = open === r.id;
            const conflicts = props.filter((p) => p.status === 'Conflict').length;

            return (
              <div className="row-card" key={r.id}>
                <header>
                  <div>
                    <div className="rt">{r.venues?.venue_name ?? 'Venue'}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                      {r.status === 'Failed'
                        ? <span style={{ color: 'var(--bad)' }}>{r.error_message}</span>
                        : <>
                            {props.length} awaiting review
                            {conflicts > 0 && ` · ${conflicts} conflict${conflicts === 1 ? '' : 's'}`}
                            {r.had_structured_data && ' · structured data'}
                          </>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center' }}>
                    {props.some((p) => p.status === 'Proposed') && (
                      <button className="link-btn" disabled={pending}
                              onClick={() => act(() => acceptAllSafe(r.id))}>
                        Accept safe fields
                      </button>
                    )}
                    <button className="link-btn"
                            onClick={() => setOpen(isOpen ? null : r.id)}>
                      {isOpen ? 'Close' : 'Review'}
                    </button>
                  </div>
                </header>

                {isOpen && !!props.length && (
                  <table>
                    <thead>
                      <tr><th>Field</th><th>Confidence</th><th>Currently</th><th>Found</th><th>Evidence</th><th></th></tr>
                    </thead>
                    <tbody>
                      {props.map((p) => (
                        <tr key={p.id}>
                          <td>
                            {LABELS[p.target_column] ?? p.target_column}
                            {p.status === 'Conflict' &&
                              <div><span className="pill" style={{ borderColor: 'var(--warn)',
                                    color: 'var(--warn)' }}>Conflict</span></div>}
                          </td>
                          <td>
                            <span className="pill" style={
                              p.confidence === 'High' ? { borderColor: 'var(--ok)', color: 'var(--ok)' }
                              : p.confidence === 'Low' ? { borderColor: 'var(--warn)', color: 'var(--warn)' }
                              : {}}>{p.confidence}</span>
                          </td>
                          <td className="v-slug" style={{ maxWidth: 180 }}>
                            {p.current_value ?? <span className="pill empty">Empty</span>}
                          </td>
                          <td style={{ maxWidth: 240, wordBreak: 'break-word' }}>{p.proposed_value}</td>
                          <td className="v-slug" style={{ maxWidth: 200, fontStyle: 'italic' }}>
                            {p.evidence}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="link-btn" disabled={pending}
                              onClick={() => act(() => decideProposal(p.id, 'Accepted'))}>Accept</button>
                            {' · '}
                            <button className="link-btn" disabled={pending}
                              onClick={() => act(() => decideProposal(p.id, 'Rejected'))}>Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {isOpen && !props.length && r.status !== 'Failed' && (
                  <div className="note" style={{ marginBottom: 0 }}>
                    Nothing left to review for this venue.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
