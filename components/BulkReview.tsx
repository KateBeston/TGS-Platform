'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  applyProposals, proposalsInGroup, rejectProposals, type ProposalGroup,
} from '@/app/actions/harvest';
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

/* ═══════════════════════════════════════════════════════════════════════
   BULK REVIEW

   Proposals grouped by field, confidence and source rather than by venue.
   Reviewing one venue at a time means opening 1,294 cards; reviewing
   "47 street addresses, all from structured data, all High confidence"
   means spot-checking five and applying the rest.

   Everything is still a decision — nothing applies without being chosen.
   What changes is the size of the unit being decided about.
   ═══════════════════════════════════════════════════════════════════════ */

export default function BulkReview({ groups }: { groups: ProposalGroup[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState<Set<string>>(new Set());

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? 'Done.') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const key = (g: ProposalGroup) =>
    `${g.column}|${g.confidence}|${g.source}|${g.status}`;

  const openGroup = (g: ProposalGroup) => {
    const k = key(g);
    if (open === k) { setOpen(null); setRows([]); return; }
    start(async () => {
      const data = await proposalsInGroup(g.column, g.confidence, g.source, g.status);
      setRows(data);
      // Everything ticked by default. The work is spotting the exception,
      // not confirming the rule.
      setChosen(new Set(data.map((r: any) => r.id)));
      setOpen(k);
    });
  };

  const toggle = (id: number) => {
    const next = new Set(chosen);
    next.has(id) ? next.delete(id) : next.add(id);
    setChosen(next);
  };

  const conf = (c: string) =>
    c === 'High' ? { borderColor: 'var(--ok)', color: 'var(--ok)' }
    : c === 'Low' ? { borderColor: 'var(--warn)', color: 'var(--warn)' }
    : {};

  const pendingTotal = groups
    .filter((g) => !done.has(key(g)))
    .reduce((s, g) => s + g.count, 0);

  return (
    <>
      <div className="ph">
        <div>
          <h2>Review by field</h2>
          <div className="ph-sub">
            {pendingTotal.toLocaleString('en-AU')} proposal{pendingTotal === 1 ? '' : 's'}{' '}
            across {groups.length} group{groups.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="ph-act">
          <Link className="btn quiet" href="/venues/harvest">By venue</Link>
        </div>
      </div>

      <div className="note">
        <strong>Grouped by field rather than by venue.</strong> Forty-seven street addresses that
        all came from schema.org markup are one judgement, not forty-seven — check a handful, and
        apply the rest.</div>

      {msg && <div className="note">{msg}</div>}

      {!groups.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing awaiting review. Run a batch on the harvest screen first.
        </div>
      )}

      {groups.map((g) => {
        const k = key(g);
        if (done.has(k)) return null;
        const isOpen = open === k;

        return (
          <div className="row-card" key={k} style={{ marginBottom: 'var(--s3)' }}>
            <header>
              <div>
                <div className="rt">
                  {LABELS[g.column] ?? g.column}
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 13,
                                 color: 'var(--ink-quiet)' }}>
                    {' '}· {g.count} venue{g.count === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-quiet)', marginTop: 3 }}>
                  <span className="pill" style={conf(g.confidence)}>{g.confidence}</span>
                  {' '}
                  <span className="pill">
                    {g.source === 'StructuredData' ? 'schema.org' : 'page text'}
                  </span>
                  {g.status === 'Conflict' && (
                    <span className="pill" style={{ borderColor: 'var(--warn)',
                                                    color: 'var(--warn)' }}>
                      Replaces an existing value
                    </span>
                  )}
                </div>
              </div>
              <button className="link-btn" disabled={pending} onClick={() => openGroup(g)}>
                {isOpen ? 'Close' : 'Review'}
              </button>
            </header>

            {isOpen && (
              <>
                <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                              flexWrap: 'wrap', marginBottom: 'var(--s3)' }}>
                  <button className="btn" disabled={pending || !chosen.size}
                    onClick={() => act(async () => {
                      const res = await applyProposals(Array.from(chosen));
                      if (res.ok) {
                        setDone(new Set([...done, k])); setOpen(null); setRows([]);
                      }
                      return res;
                    })}>
                    Apply {chosen.size} of {rows.length}
                  </button>
                  <button className="btn quiet" disabled={pending || !chosen.size}
                    onClick={() => act(async () => {
                      const res = await rejectProposals(Array.from(chosen));
                      if (res.ok) {
                        setDone(new Set([...done, k])); setOpen(null); setRows([]);
                      }
                      return res;
                    })}>
                    Reject {chosen.size}
                  </button>
                  <button className="link-btn"
                    onClick={() => setChosen(chosen.size === rows.length
                      ? new Set() : new Set(rows.map((r) => r.id)))}>
                    {chosen.size === rows.length ? 'Untick all' : 'Tick all'}
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                    Untick anything that looks wrong
                  </span>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}></th>
                      <th>Venue</th>
                      {g.status === 'Conflict' && <th>Currently</th>}
                      <th>Proposed</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const on = chosen.has(r.id);
                      const venue = r.extraction_runs?.venues?.venue_name;
                      const venueId = r.extraction_runs?.venue_id;
                      return (
                        <tr key={r.id} style={{ opacity: on ? 1 : 0.4 }}>
                          <td>
                            <input type="checkbox" checked={on}
                              onChange={() => toggle(r.id)} data-bwignore
                              style={{ cursor: 'pointer' }} />
                          </td>
                          <td>
                            {venueId ? (
                              <Link href={`/venues/${venueId}/details`}
                                    style={{ textDecoration: 'none' }}>
                                <span className="v-name">{venue ?? `Venue ${venueId}`}</span>
                              </Link>
                            ) : <span className="v-name">Unknown</span>}
                          </td>
                          {g.status === 'Conflict' && (
                            <td className="v-slug" style={{ maxWidth: 180 }}>
                              {r.current_value ?? <span className="pill empty">Empty</span>}
                            </td>
                          )}
                          <td style={{ maxWidth: 260, wordBreak: 'break-word' }}>
                            {r.proposed_value}
                          </td>
                          <td className="v-slug" style={{ maxWidth: 200, fontStyle: 'italic' }}>
                            {/^Personal address/i.test(r.evidence ?? '') && (
                              <span className="pill" style={{ borderColor: 'var(--warn)',
                                                              color: 'var(--warn)',
                                                              marginRight: 5,
                                                              fontStyle: 'normal' }}>
                                Personal
                              </span>
                            )}
                            {r.evidence}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
