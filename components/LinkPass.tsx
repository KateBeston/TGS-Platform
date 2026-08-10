'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { batchRefreshLinks } from '@/app/actions/venueIntake';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   THE LINK PASS

   Every venue with a website, read for its social and external links.

   Free, which changes what is sensible. No model is called — the links
   are sitting in the markup, and asking a model to repeat a URL back is
   a way of introducing typos into something already correct. So this can
   run across everything rather than being rationed.
   ═══════════════════════════════════════════════════════════════════════ */

export default function LinkPass({ state, recent }: { state: Row; recent: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [batch, setBatch] = useState(40);
  const [msg, setMsg] = useState('');

  const run = () => start(async () => {
    report('saving');
    const res = await batchRefreshLinks(batch);
    setMsg(res.ok ? (res.message ?? '') : (res as any).error);
    report(res.ok ? 'saved' : 'error');
  });

  const remaining = state.not_checked ?? 0;
  const done = state.checked ?? 0;
  const total = state.with_website ?? 0;

  return (
    <>
      <div className="ph">
        <div>
          <h2>Links</h2>
          <div className="ph-sub">
            {done.toLocaleString('en-AU')} of {total.toLocaleString('en-AU')} venues read
          </div>
        </div>
      </div>

      <div className="note">
        <strong>This costs nothing.</strong> No model is called — the links are in the markup and
        fetching a page is free. So it runs across every venue with a website rather than being
        rationed, and can be re-run whenever.</div>

      <div className="stats">
        <div className="stat">
          <div className={`v ${remaining ? '' : 'zero'}`}>
            {remaining.toLocaleString('en-AU')}
          </div>
          <div className="l">Still to read</div>
        </div>
        <div className="stat">
          <div className={`v ${state.links_total ? '' : 'zero'}`}>
            {(state.links_total ?? 0).toLocaleString('en-AU')}
          </div>
          <div className="l">Links found</div>
        </div>
        <div className="stat">
          <div className={`v ${state.instagram ? '' : 'zero'}`}>{state.instagram ?? 0}</div>
          <div className="l">Instagram</div>
        </div>
        <div className="stat">
          <div className={`v ${state.facebook ? '' : 'zero'}`}>{state.facebook ?? 0}</div>
          <div className="l">Facebook</div>
        </div>
        <div className="stat">
          <div className={`v ${state.tripadvisor ? '' : 'zero'}`}>{state.tripadvisor ?? 0}</div>
          <div className="l">TripAdvisor</div>
        </div>
        <div className="stat">
          <div className={`v ${state.whatsapp ? '' : 'zero'}`}>{state.whatsapp ?? 0}</div>
          <div className="l">WhatsApp</div>
        </div>
      </div>

      <div className="sect">
        <h3>Run a batch</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      flexWrap: 'wrap' }}>
          <div className="f" style={{ maxWidth: 140 }}>
            <label htmlFor="n">Venues to read</label>
            <select id="n" value={batch} onChange={(e) => setBatch(Number(e.target.value))}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }}>
              {[20, 40, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn" disabled={pending || !remaining} onClick={run}>
            {pending ? 'Reading…' : 'Read the next batch'}
          </button>
          <span className="help" style={{ alignSelf: 'center', margin: 0 }}>
            Six sites at a time · {remaining.toLocaleString('en-AU')} left
          </span>
        </div>
        {msg && <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>{msg}</div>}
      </div>

      {!!recent.length && (
        <div className="sect">
          <h3>Recently read</h3>
          <table>
            <thead>
              <tr><th>Venue</th><th>Found</th><th>Which</th><th>When</th></tr>
            </thead>
            <tbody>
              {recent.map((v) => {
                const which = [
                  v.instagram_url && 'Instagram',
                  v.facebook_url && 'Facebook',
                  v.youtube_url && 'YouTube',
                  v.tripadvisor_url && 'TripAdvisor',
                  v.whatsapp_number && 'WhatsApp',
                  v.other_links?.length && `${v.other_links.length} other`,
                ].filter(Boolean);
                return (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/venues/${v.id}/details`} style={{ textDecoration: 'none' }}>
                        <span className="v-name" style={{ fontSize: 16 }}>{v.venue_name}</span>
                      </Link>
                    </td>
                    <td>
                      {v.links_found
                        ? <span style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>
                            {v.links_found}
                          </span>
                        : <span className="pill empty">None</span>}
                    </td>
                    <td className="v-slug">{which.join(' · ') || '—'}</td>
                    <td className="v-slug">
                      {new Date(v.links_checked_at).toLocaleDateString('en-AU',
                        { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
