'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { applyChanges } from '@/app/actions/venueIntake';
import RereadVenue from './RereadVenue';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;
type Change = {
  column: string; label: string; current: any; proposed: any; isNew: boolean;
};

/* ═══════════════════════════════════════════════════════════════════════
   WHAT CHANGED

   A re-read never overwrites. It produces a list of differences, each
   accepted or ignored — because the record has usually been corrected by
   hand since it was first read, and a silent overwrite would undo exactly
   the work that made it right.

   New values are ticked by default; changes to something already recorded
   are not. Filling a blank is nearly always an improvement; replacing a
   checked value is a judgement.
   ═══════════════════════════════════════════════════════════════════════ */

/** Which tab a column lives on.
 *
 *  Checking a difference against the record means finding the field, and
 *  eleven tabs is too many to guess through. Falls back to details, which
 *  is where most of them are. */
function tabFor(column: string): string {
  // The setting has its own tab, so it comes before location.
  if (/^(setting_|orientation|climate_type)/.test(column)) return 'setting';
  if (/^(street_address|postcode|city_id|state_id|country_id|latitude|longitude|maps_url|timezone|location_|nearby|transport|parking|property_size|floor_area|entrance_|google_place|directions|coordinates)/.test(column)) {
    return 'location';
  }
  if (/^(max_guests|min_guests|total_|beds_|accessible|elevator|ground_floor|check_in|check_out|early_|late_|children|minimum_child|pets_|smoking|languages|treatment_rooms|couples_suites|day_guest|shared_|private_|property_type|accommodation_desc|access_policy|has_access|cultural_|hosting_|permits_|first_aid|defibrillator|emergency_|safety_|water_quality|public_liability|minimum_stay)/.test(column)) {
    return 'capacity';
  }
  if (/^(price|tax_|prices_)/.test(column)) return 'pricing';
  if (/^(venue_full|venue_short|introduction|hero_quote|editor_note|venue_highlights|best_for|ideal_types|signature|experience_|pool_type|sustainability|environment)/.test(column)) {
    return 'record-content';
  }
  if (/^(commission|internal|lead_|attribution|stripe_|market_segment|venue_tier)/.test(column)) {
    return 'internal';
  }
  if (/^(primary_image_url|experience_image_url|host_image_url|featured_space_id)/.test(column)) {
    return 'media';
  }
  return 'details';
}

export default function RereadReview({
  venue, draft, changes, history,
}: { venue: Row; draft: Row | null; changes: Change[]; history: Row[] }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<Set<string>>(
    new Set(changes.filter((c) => c.isNew).map((c) => c.column)));
  const [msg, setMsg] = useState('');

  const toggle = (col: string) => {
    const next = new Set(chosen);
    next.has(col) ? next.delete(col) : next.add(col);
    setChosen(next);
  };

  const additions = changes.filter((c) => c.isNew);
  const revisions = changes.filter((c) => !c.isNew);

  return (
    <>
      <div className="ph">
        <div>
          <h2>Read again</h2>
          <div className="ph-sub">
            {venue.venue_name}
            {draft
              ? ` · ${changes.length} difference${changes.length === 1 ? '' : 's'} from what is recorded`
              : ' · not read yet'}
          </div>
        </div>
        {/* Comparing a difference usually means wanting to see the record
            it is being compared against, and going back out through the
            venue list to do that is three clicks for one glance. */}
        <div className="ph-act">
          <Link className="btn quiet" href={`/venues/${venue.id}/details`}>
            Open the venue
          </Link>

          {venue.website_url && (
            <a className="btn quiet" href={venue.website_url}
               target="_blank" rel="noopener">
              Their site
            </a>
          )}
        </div>
      </div>

      <div className="sect">
        <h3>Their site</h3>
        <RereadVenue
          venueId={venue.id}
          websiteUrl={venue.website_url}
          lastReadAt={venue.last_intake_at}
          lastDraftId={venue.last_intake_draft_id}
        />
      </div>

      {draft?.status === 'Failed' && (
        <div className="note bad">
          <strong>That read failed.</strong> {draft.error_message}
        </div>
      )}

      {draft?.payload?.flags?.length ? (
        <div className="note bad">
          <strong>Worth checking:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {draft.payload.flags.map((f: string, i: number) => (
              <li key={i} style={{ marginBottom: 4 }}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {msg && <div className="note">{msg}</div>}

      {draft?.skipped_no_change && (
        <div className="note">
          <strong>Their site has not changed, so nothing was spent.</strong> All{' '}
          {draft.unchanged_pages} pages match the last read exactly, so there was nothing new to
          read and the previous answer still stands.</div>
      )}

      {draft && !changes.length && !draft.skipped_no_change && draft.status !== 'Failed' && (
        <div className="note">
          <strong>Nothing differs.</strong> Their site has changed since the last read, but not in
          any field recorded here.
        </div>
      )}

      {!!draft?.changed_pages && (
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          {draft.changed_pages} page{draft.changed_pages === 1 ? '' : 's'} changed,{' '}
          {draft.unchanged_pages ?? 0} unchanged
        </div>
      )}

      {!!changes.length && (
        <div className="sect">
          <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
            <div>
              <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
                Differences
              </h3>
              <div className="ph-sub">
                {additions.length} new · {revisions.length} changed
              </div>
            </div>
            <div className="ph-act">
              <button className="btn" disabled={pending || !chosen.size}
                onClick={() => start(async () => {
                  report('saving');
                  const res = await applyChanges(draft!.id, Array.from(chosen));
                  setMsg(res.ok ? (res.message ?? '') : (res as any).error);
                  report(res.ok ? 'saved' : 'error');
                  if (res.ok) router.refresh();
                })}>
                Apply {chosen.size}
              </button>
            </div>
          </div>

          <div className="note">
            <strong>Nothing is overwritten without being chosen.</strong> New values are ticked;
            changes to something already recorded are not — filling a blank is nearly always an
            improvement, replacing a checked value is a judgement.
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>Field</th><th>Recorded</th><th>Their site now says</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => {
                const on = chosen.has(c.column);
                return (
                  <tr key={c.column} style={{ opacity: on ? 1 : 0.45 }}>
                    <td>
                      <input type="checkbox" checked={on} data-bwignore
                        onChange={() => toggle(c.column)}
                        style={{ cursor: 'pointer' }} />
                    </td>
                    <td>
                      <Link href={`/venues/${venue.id}/${tabFor(c.column)}`}
                            target="_blank"
                            style={{ textDecoration: 'none' }}
                            title="Open the tab this lives on">
                        <span className="v-name" style={{ fontSize: 16 }}>{c.label}</span>
                      </Link>
                      {c.isNew && (
                        <div><span className="pill empty" style={{ fontSize: 9 }}>New</span></div>
                      )}
                    </td>
                    <td className="v-slug" style={{ maxWidth: 240, wordBreak: 'break-word' }}>
                      {c.current ?? <span className="pill empty">Empty</span>}
                    </td>
                    <td style={{ maxWidth: 280, wordBreak: 'break-word' }}>
                      {String(c.proposed)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!!history.length && (
        <div className="sect">
          <h3>Every read of this site</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            {history.length} read{history.length === 1 ? '' : 's'}
            {' · '}
            {history.reduce((t, h) => t + Number(h.cost_usd ?? 0), 0) > 0
              ? `$${history.reduce((t, h) => t + Number(h.cost_usd ?? 0), 0).toFixed(3)} in total`
              : 'nothing spent yet'}
          </div>
          <table>
            <thead><tr>
              <th>When</th><th>Kind</th><th>Pages</th>
              <th>Found</th><th>State</th><th>Cost</th><th></th>
            </tr></thead>
            <tbody>
              {history.map((h) => {
                const read = (h.pages_read ?? []).length;
                const unchanged = (h.unchanged_pages ?? []).length;
                return (
                <tr key={h.id} style={{
                  background: h.id === draft?.id ? 'var(--warm-cream)' : undefined }}>
                  <td className="v-slug" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(h.created_at).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short', year: 'numeric' })}
                    <div style={{ color: 'var(--muted)' }}>
                      {new Date(h.created_at).toLocaleTimeString('en-AU',
                        { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="v-slug">
                    {h.run_kind ?? 'First read'}
                    {h.id === draft?.id && (
                      <div><span className="pill gold" style={{ fontSize: 9 }}>
                        showing
                      </span></div>
                    )}
                  </td>
                  <td className="v-slug">
                    {read || '—'}
                    {/* Pages skipped because nothing had moved. The whole
                        point of hashing, and invisible without saying so. */}
                    {unchanged > 0 && (
                      <div style={{ color: 'var(--ok)' }}>
                        {unchanged} unchanged
                      </div>
                    )}
                  </td>
                  <td className="v-slug">
                    {h.logo_url ? 'logo' : ''}
                    {h.pages_failed > 0 && (
                      <div style={{ color: 'var(--warn)' }}>
                        {h.pages_failed} failed
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="pill empty">{h.status}</span>
                    {h.error_message && (
                      <div className="v-slug" style={{ color: 'var(--bad)' }}>
                        {h.error_message}
                      </div>
                    )}
                  </td>
                  <td className="v-slug">
                    {h.cost_usd ? `$${Number(h.cost_usd).toFixed(3)}` : 'free'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {h.id !== draft?.id && (
                      <Link className="link-btn"
                            href={`/venues/${venue.id}/reread?draft=${h.id}`}>Open</Link>
                    )}
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
