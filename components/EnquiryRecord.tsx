'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  addToShortlist, removeFromShortlist, saveEnquiryField, saveMatchField,
} from '@/app/actions/enquiries';
import DateOptions from './DateOptions';
import RequirementsPanel from './RequirementsPanel';
import VenueSearchPanel from './VenueSearchPanel';
import { createItineraryFromEnquiry } from '@/app/actions/itineraries';
import { useRouter } from 'next/navigation';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const STATUSES = ['New', 'In Progress', 'Presented', 'Won', 'Lost', 'No Response', 'Spam'];
const MATCH_STATUSES = ['Candidate', 'Approached', 'Available', 'Unavailable', 'Quoted', 'Presented', 'Selected', 'Declined', 'Withdrawn'];
const BUDGET_BANDS = ['Under 5k', '5k–10k', '10k–20k', '20k–50k', '50k+', 'Not stated'];

export default function EnquiryRecord({
  enquiry, matches, countries, categories, practices, outcomes, venueTypes,
  requirementTypes, requirements, dateOptions, searchOpts, countryCode,
}: {
  enquiry: Row; matches: Row[];
  countries: Row[]; categories: Row[]; practices: Row[]; outcomes: Row[]; venueTypes: Row[];
  requirementTypes: Row[]; requirements: Row[]; dateOptions: Row[];
  searchOpts: Record<string, Row[]>; countryCode?: string | null;
}) {
  const { report } = useSaveState();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [list, setList] = useState(matches);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  const save = (col: string, v: unknown) => act(() => saveEnquiryField(enquiry.id, col, v));

  const sel = { background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                padding: '8px 10px', width: '100%', fontSize: 13 };
  const name = [enquiry.first_name, enquiry.surname].filter(Boolean).join(' ') || enquiry.email || 'Unnamed';
  const relevantPractices = enquiry.category_id
    ? practices.filter((p) => p.category_id === enquiry.category_id) : practices;

  return (
    <>
      <div className="ph">
        <div>
          <h2>{name}</h2>
          <div className="ph-sub">
            {enquiry.enquiry_type} · received {new Date(enquiry.created_at).toLocaleDateString('en-AU')}
            {enquiry.responded_at && ` · presented ${new Date(enquiry.responded_at).toLocaleDateString('en-AU')}`}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" disabled={pending}
            onClick={() => start(async () => {
              const res = await createItineraryFromEnquiry(enquiry.id);
              if (res.ok && res.id) router.push(`/itineraries/${res.id}`);
              else if (!res.ok) alert(res.error);
            })}>Build itinerary</button>
          <Link className="btn quiet" href={`/enquiries/${enquiry.id}/brief`}>Brief</Link>
          <select defaultValue={enquiry.status} disabled={pending} style={{ ...sel, width: 'auto' }}
                  onChange={(e) => save('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="sect">
        <h3>Who</h3>
        <div className="grid">
          <F label="First name" initial={enquiry.first_name} onSave={(v) => save('first_name', v)} />
          <F label="Surname" initial={enquiry.surname} onSave={(v) => save('surname', v)} />
          <F label="Email" initial={enquiry.email} onSave={(v) => save('email', v)} />
          <F label="Phone" initial={enquiry.phone} onSave={(v) => save('phone', v)} />
        </div>
      </div>

      <div className="sect">
        <h3>What they asked for</h3>
        <div className="note" style={{ marginBottom: 'var(--s4)' }}>
          Every field here is something the Institute can report on. Anything captured only in the
          notes is invisible to it — which is why these are fields rather than prose.
        </div>
        <div className="grid">
          <S label="Country" value={enquiry.country_id} options={countries} blank="Anywhere"
             onSave={(v) => save('country_id', v)} />
          <F label="Destination notes" initial={enquiry.destination_notes}
             onSave={(v) => save('destination_notes', v)} help="If they named somewhere specific" />
          <S label="Category" value={enquiry.category_id} options={categories} blank="Not stated"
             onSave={(v) => save('category_id', v)} />
          <S label="Practice" value={enquiry.practice_id} options={relevantPractices} blank="Not stated"
             onSave={(v) => save('practice_id', v)} />
          <S label="Outcome sought" value={enquiry.outcome_id} options={outcomes} blank="Not stated"
             onSave={(v) => save('outcome_id', v)} />
          <S label="Venue type" value={enquiry.venue_type_id} options={venueTypes} blank="Any"
             onSave={(v) => save('venue_type_id', v)} />
          <D label="From" initial={enquiry.date_from} onSave={(v) => save('date_from', v)} />
          <D label="To" initial={enquiry.date_to} onSave={(v) => save('date_to', v)} />
          <F label="Nights" type="number" initial={enquiry.nights}
             onSave={(v) => save('nights', v === null ? null : Number(v))} />
          <F label="Guests" type="number" initial={enquiry.guest_count}
             onSave={(v) => save('guest_count', v === null ? null : Number(v))} />
          <F label="Bedrooms required" type="number" initial={enquiry.bedrooms_required}
             onSave={(v) => save('bedrooms_required', v === null ? null : Number(v))} />
          <div className="f">
            <label>Budget band</label>
            <select defaultValue={enquiry.budget_band ?? ''} disabled={pending} style={sel}
                    onChange={(e) => save('budget_band', e.target.value || null)}>
              <option value="">Not stated</option>
              {BUDGET_BANDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <F label="Budget amount" type="number" initial={enquiry.budget_amount}
             onSave={(v) => save('budget_amount', v === null ? null : Number(v))} />
          <F label="Setting preference" initial={enquiry.setting_preference}
             onSave={(v) => save('setting_preference', v)} />
        </div>

        <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
          <button type="button" disabled={pending}
            className={`pill ${enquiry.dates_flexible ? 'gold' : ''}`}
            style={{ cursor: 'pointer',
                     background: enquiry.dates_flexible ? undefined : 'var(--warm-white)' }}
            onClick={() => save('dates_flexible', !enquiry.dates_flexible)}>
            Dates flexible
          </button>
        </div>

        <div className="grid one" style={{ marginTop: 'var(--s4)' }}>
          <F label="Notes" textarea initial={enquiry.notes} onSave={(v) => save('notes', v)}
             help="Anything the fields above cannot hold" />
        </div>
      </div>

      <DateOptions enquiryId={enquiry.id} options={dateOptions}
                   countryCode={countryCode ?? null}
                   venueIds={list.map((m) => m.venue_id)} />

      <RequirementsPanel enquiryId={enquiry.id} types={requirementTypes}
                         requirements={requirements} shortlist={list} />

      {/* ── shortlist ─────────────────────────────────────────────── */}
      <div className="sect">
        <h3>Shortlist</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          {list.length} venue{list.length === 1 ? '' : 's'}
        </div>

        <VenueSearchPanel
          options={searchOpts} saved={[]} compact pickLabel="Shortlist"
          alreadyPicked={list.map((m) => m.venue_id)}
          onPick={(venueId, venueName) => act(async () => {
            const res = await addToShortlist(enquiry.id, venueId);
            if (res.ok) setList([...list, { id: Date.now(), venue_id: venueId,
              match_status: 'Candidate', venues: { id: venueId, venue_name: venueName } }]);
            return res;
          })}
        />

        {!list.length && <div className="note">Nothing shortlisted yet.</div>}

        <div className="rows">
          {list.map((m) => (
            <div className="row-card" key={m.id}>
              <header>
                <div>
                  <div className="rt">{m.venues?.venue_name ?? 'Venue'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                    {[m.venues?.cities?.name, m.venues?.countries?.name].filter(Boolean).join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
                  <select defaultValue={m.match_status ?? 'Candidate'} disabled={pending}
                    onChange={(e) => act(() =>
                      saveMatchField(m.id, enquiry.id, 'match_status', e.target.value))}
                    style={{ ...sel, width: 'auto' }}>
                    {MATCH_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button className="link-btn" disabled={pending}
                    onClick={() => act(async () => {
                      const res = await removeFromShortlist(m.id, enquiry.id);
                      if (res.ok) setList(list.filter((x) => x.id !== m.id));
                      return res;
                    })}>Remove</button>
                </div>
              </header>

              <div className="grid">
                <F label="Why this venue" textarea initial={m.why_this_venue}
                   onSave={(v) => act(() => saveMatchField(m.id, enquiry.id, 'why_this_venue', v))}
                   help="What goes in the proposal. The reason it is a recommendation rather than a result." />
                <div>
                  <F label="Quoted amount" type="number" initial={m.quoted_amount}
                     onSave={(v) => act(() => saveMatchField(m.id, enquiry.id, 'quoted_amount',
                       v === null ? null : Number(v)))} />
                  <F label="Decline reason" initial={m.decline_reason}
                     onSave={(v) => act(() => saveMatchField(m.id, enquiry.id, 'decline_reason', v))}
                     help="Why it did not work — the other half of the demand picture" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sect">
        <h3>Outcome</h3>
        <div className="grid">
          <F label="Assigned to" initial={enquiry.assigned_to} onSave={(v) => save('assigned_to', v)} />
          <D label="Response due" initial={enquiry.response_due}
             onSave={(v) => save('response_due', v)} />
          <F label="Estimated value" type="number" initial={enquiry.estimated_value}
             onSave={(v) => save('estimated_value', v === null ? null : Number(v))} />
          <F label="Lost reason" initial={enquiry.lost_reason} onSave={(v) => save('lost_reason', v)}
             help="Only where the status is Lost" />
        </div>
      </div>
    </>
  );
}

function F({
  label, initial, onSave, type = 'text', help, textarea,
}: {
  label: string; initial: any; onSave: (v: string | null) => void;
  type?: string; help?: string; textarea?: boolean;
}) {
  const [v, setV] = useState(initial ?? '');
  const commit = () => { if (String(v) !== String(initial ?? '')) onSave(v === '' ? null : v); };
  return (
    <div className="f">
      <label>{label}</label>
      {textarea
        ? <textarea data-bwignore value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
        : <input data-bwignore type={type} value={v}
                 onChange={(e) => setV(e.target.value)} onBlur={commit} />}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

function S({
  label, value, options, blank, onSave,
}: {
  label: string; value: any; blank: string;
  options: Row[]; onSave: (v: number | null) => void;
}) {
  return (
    <div className="f">
      <label>{label}</label>
      <select defaultValue={value ?? ''}
        onChange={(e) => onSave(e.target.value ? Number(e.target.value) : null)}
        style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                 padding: '8px 10px', width: '100%', fontSize: 13 }}>
        <option value="">{blank}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

function D({ label, initial, onSave }: { label: string; initial: any; onSave: (v: string | null) => void }) {
  const asDate = initial ? String(initial).slice(0, 10) : '';
  const [v, setV] = useState(asDate);
  return (
    <div className="f">
      <label>{label}</label>
      <input type="date" data-bwignore value={v} onChange={(e) => setV(e.target.value)}
             onBlur={() => v !== asDate && onSave(v || null)} />
    </div>
  );
}
