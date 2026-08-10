'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  addOffMarket, attachPerson, createPersonFrom, findPeople, historyFor,
  moveTo, saveEnquiry, saveOffMarket, saveShortlisted, shortlist, unshortlist,
} from '@/app/actions/concierge';
import VenueSearchPanel from './VenueSearchPanel';
import WhoIsAsking from './WhoIsAsking';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   ONE ENQUIRY, STEP BY STEP

   Six screens rather than one long form. A concierge search is a
   conversation and the answers arrive in order — who is asking, what they
   want, where and when, what it is worth, then which venues.

   Each step saves as it goes and the record reopens where it was left,
   because an enquiry taken over the phone is interrupted more often than
   it is finished.

   Wellness and retreat ask different questions from step two onward. A
   wellness guest wants a treatment on a Saturday; a retreat host wants a
   shala for eighteen people in November.
   ═══════════════════════════════════════════════════════════════════════ */

const STEPS = [
  'Who is asking', 'What they want', 'Where and when',
  'What it is worth', 'Choosing venues', 'Ready to present',
] as const;

export default function EnquirySteps({
  enquiry, hostTypes, categories, outcomes, audiences, formats, countries,
  searchOptions, savedSearches,
}: {
  enquiry: Row; hostTypes: Row[]; categories: Row[]; outcomes: Row[];
  audiences: Row[]; formats: Row[]; countries: Row[];
  searchOptions: any; savedSearches: Row[];
}) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<string>(enquiry.step ?? STEPS[0]);
  const [msg, setMsg] = useState('');
  const [offMarket, setOffMarket] = useState({ name: '', url: '', where: '' });
  const [peopleSearch, setPeopleSearch] = useState('');
  const [people, setPeople] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);

  const isRetreat = enquiry.enquiry_type === 'Retreat Host';
  const e = enquiry;

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
  });

  const save = (col: string, v: unknown) => act(() => saveEnquiry(e.id, col, v));

  const goTo = (s: string) => {
    setStep(s);
    saveEnquiry(e.id, 'step', s);
  };

  const F = ({ label, col, type = 'text', help, options, wide }: {
    label: string; col: string; type?: string; help?: string;
    options?: Row[]; wide?: boolean;
  }) => (
    <div className="f" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={col}>{label}</label>
      {options ? (
        <select id={col} style={sel} defaultValue={e[col] ?? ''}
          onChange={(ev) => save(col, ev.target.value ? Number(ev.target.value) : null)}>
          <option value="">Not asked</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea id={col} data-bwignore defaultValue={e[col] ?? ''}
          onBlur={(ev) => ev.target.value !== (e[col] ?? '')
            && save(col, ev.target.value || null)} />
      ) : (
        <input id={col} data-bwignore style={sel} type={type}
          defaultValue={e[col] ?? ''}
          onBlur={(ev) => {
            const v = type === 'number'
              ? (ev.target.value === '' ? null : Number(ev.target.value))
              : (ev.target.value || null);
            if (String(v ?? '') !== String(e[col] ?? '')) save(col, v);
          }} />
      )}
      {help && <span className="help">{help}</span>}
    </div>
  );

  return (
    <>
      <div className="ph">
        <div>
          <h2>
            {[e.first_name, e.surname].filter(Boolean).join(' ') || 'A new enquiry'}
          </h2>
          <div className="ph-sub">
            {e.enquiry_reference ?? `#${e.id}`} · {isRetreat ? 'Retreat' : 'Wellness'} ·{' '}
            {e.status}
          </div>
        </div>
        <div className="ph-act">
          <Link className="btn quiet" href="/concierge">Back to the pipeline</Link>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {/* Six screens rather than one long form. A search taken over the
          phone is interrupted more often than it is finished. */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
                    marginBottom: 'var(--s5)', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <button key={s} type="button" onClick={() => goTo(s)}
            style={{
              background: 'transparent', border: 0,
              borderBottom: step === s ? '2px solid var(--gold)' : '2px solid transparent',
              padding: '10px 14px', fontSize: 12, letterSpacing: '.06em',
              cursor: 'pointer',
              color: step === s ? 'var(--charcoal)' : 'var(--ink-quiet)',
            }}>
            <span style={{ color: 'var(--muted)', marginRight: 6 }}>{i + 1}</span>{s}
          </button>
        ))}
      </div>

      {step === 'Who is asking' && (
        <>
          {/* Searched before typed, since somebody ringing is usually
              already on record and two records for one person is how a
              history gets lost. */}
          <WhoIsAsking
            enquiryId={e.id}
            kind={isRetreat ? 'host' : 'guest'}
            attached={
              e.retreat_host_id || e.wellness_guest_id
                ? { id: e.retreat_host_id ?? e.wellness_guest_id,
                    name: [e.first_name, e.surname].filter(Boolean).join(' ')
                          || e.email || 'On record' }
                : null
            } />

        <div className="sect">
          <h3>Their details</h3>
          <div className="grid">
            <F label="First name" col="first_name" />
            <F label="Surname" col="surname" />
            <F label="Email" col="email" />
            <F label="Phone" col="phone" />
            {isRetreat && (
              <>
                <F label="What they are" col="host_type_id" options={hostTypes}
                   help="Fourteen yoga teachers asked and three booked is the figure worth having." />
                <F label="Or in their words" col="host_type_other" />
              </>
            )}
            <F label="Anything about them" col="notes" type="textarea" wide />
          </div>
        </div>
        </>
      )}

      {step === 'What they want' && (
        <div className="sect">
          <h3>What they want</h3>
          <div className="grid">
            <F label={isRetreat ? 'What kind of retreat' : 'What kind of wellness'}
               col="category_id" options={categories} />
            {isRetreat ? (
              <>
                <F label="What they are after" col="outcome_id" options={outcomes}
                   help="People search by outcome — burnout, sleep — before they search by modality." />
                <F label="Who it is for" col="audience_id" options={audiences} />
                <F label="How it runs" col="format_id" options={formats} />
                <F label="Spaces they need" col="required_spaces"
                   help="A shala, a treatment room, somewhere to eat together." />
              </>
            ) : (
              <>
                <F label="How long" col="duration_minutes" type="number" />
                <F label="How many sessions" col="session_count" type="number" />
                <F label="Who is coming" col="party_composition" />
              </>
            )}
            <F label="Anything they must have" col="access_needs_note" type="textarea" wide
               help="Step-free access, a dietary requirement, something they asked about twice." />
          </div>
        </div>
      )}

      {step === 'Where and when' && (
        <div className="sect">
          <h3>Where and when</h3>
          <div className="grid">
            <F label="Country" col="country_id" options={countries} />
            <F label="Or roughly where" col="destination_notes"
               help="Somewhere warm, within three hours of Sydney, near the sea." />
            <F label="Arriving" col="date_from" type="date" />
            <F label="Leaving" col="date_to" type="date" />
            <F label="Nights" col="nights" type="number" />
            <F label="How many people" col="guest_count" type="number" />
            {isRetreat && <F label="Bedrooms needed" col="bedrooms_required" type="number" />}
            <div className="f">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8,
                              cursor: 'pointer' }}>
                <input type="checkbox" data-bwignore defaultChecked={!!e.dates_flexible}
                  onChange={(ev) => save('dates_flexible', ev.target.checked)} />
                The dates can move
              </label>
              <span className="help">
                Worth knowing before searching — it doubles what is available.
              </span>
            </div>
          </div>
        </div>
      )}

      {step === 'What it is worth' && (
        <div className="sect">
          <h3>What it is worth</h3>
          <div className="grid">
            <F label="Budget band" col="budget_band" />
            <F label="Or a number" col="budget_amount" type="number" />
            <F label="Currency" col="currency" />
            <F label="What we think it is worth" col="estimated_value" type="number"
               help="What TGS would earn if it lands. Used for the pipeline figure." />
            <F label="Answer due by" col="response_due" type="date" />
            <F label="Who is on it" col="assigned_to" />
          </div>
        </div>
      )}

      {step === 'Choosing venues' && (
        <>
          <div className="sect">
            <h3>The shortlist</h3>
            {!e.shortlist.length ? (
              <div className="note" style={{ marginBottom: 0 }}>
                Nothing yet. Search below and add what fits.
              </div>
            ) : (
              <table>
                <thead>
                  <tr><th>Venue</th><th>Why this one</th><th>Quoted</th>
                      <th>State</th><th></th></tr>
                </thead>
                <tbody>
                  {e.shortlist.map((s: Row) => (
                    <tr key={s.id}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {s.venues?.logo_url && (
                          <img src={s.venues.logo_url} alt=""
                            style={{ height: 22, maxWidth: 56, objectFit: 'contain' }} />
                        )}
                        <div>
                          <Link href={`/venues/${s.venue_id}/details`}
                                style={{ textDecoration: 'none' }}>
                            <span className="v-name" style={{ fontSize: 14 }}>
                              {s.venues?.venue_name}
                            </span>
                          </Link>
                          <div className="v-slug">
                            {[s.venues?.cities?.name, s.venues?.countries?.name]
                              .filter(Boolean).join(', ')}
                            {s.venues?.max_guests ? ` · takes ${s.venues.max_guests}` : ''}
                          </div>
                        </div>
                      </td>
                      <td>
                        <input data-bwignore style={{ ...sel, fontSize: 12 }}
                          defaultValue={s.why_this_venue ?? ''}
                          placeholder="What makes it right"
                          onBlur={(ev) => ev.target.value !== (s.why_this_venue ?? '')
                            && act(() => saveShortlisted(s.id, 'why_this_venue',
                                                          ev.target.value || null, e.id))} />
                      </td>
                      <td>
                        <input type="number" data-bwignore style={{ ...sel, width: 100, fontSize: 12 }}
                          defaultValue={s.quoted_amount ?? ''}
                          onBlur={(ev) => act(() => saveShortlisted(s.id, 'quoted_amount',
                            ev.target.value === '' ? null : Number(ev.target.value), e.id))} />
                      </td>
                      <td>
                        <select style={{ ...sel, fontSize: 12 }}
                          defaultValue={s.match_status ?? 'Candidate'}
                          onChange={(ev) => act(() => saveShortlisted(s.id, 'match_status',
                                                                      ev.target.value, e.id))}>
                          {['Candidate','Approached','Available','Unavailable',
                            'Quoted','Presented','Selected','Declined',
                            'Withdrawn'].map((x) => <option key={x}>{x}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="link-btn" disabled={pending}
                          onClick={() => act(() => unshortlist(s.id, e.id))}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* The same search as the venues page, here because this is
              where somebody is actually looking for one. */}
          <VenueSearchPanel
            options={searchOptions}
            saved={savedSearches}
            compact
            pickLabel="Add to the shortlist"
            alreadyPicked={e.shortlist.map((s: Row) => s.venue_id)}
            onPick={(venueId: number) => act(() => shortlist(e.id, venueId))} />

          <div className="sect">
            <h3>Nothing here fits</h3>
            <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
              Venues found outside the collection, for this enquiry
            </div>

            <div className="note">
              Kept apart from the venues list, because a place found for one host is not yet a
              listing. Mark one as worth having and it becomes a candidate — which is how the
              collection grows from what people actually asked for.
            </div>

            {!!e.offMarket.length && (
              <table>
                <thead><tr><th>Name</th><th>Where</th><th>How it went</th>
                           <th>Worth listing</th></tr></thead>
                <tbody>
                  {e.offMarket.map((o: Row) => (
                    <tr key={o.id}>
                      <td>
                        <span className="v-name" style={{ fontSize: 14 }}>{o.name}</span>
                        {o.website_url && (
                          <div className="v-slug">
                            <a href={o.website_url} target="_blank" rel="noopener">
                              {o.website_url.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="v-slug">{o.where_it_is ?? '—'}</td>
                      <td>
                        <select style={{ ...sel, fontSize: 12 }} defaultValue={o.outcome}
                          onChange={(ev) => act(() => saveOffMarket(o.id, 'outcome',
                                                                    ev.target.value, e.id))}>
                          {['Looking into it','Quoted','Presented','Booked',
                            'Not suitable','No reply'].map((x) => <option key={x}>{x}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" data-bwignore
                          defaultChecked={!!o.worth_listing}
                          onChange={(ev) => act(() => saveOffMarket(o.id, 'worth_listing',
                                                                    ev.target.checked, e.id))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                          marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
              <div className="f" style={{ minWidth: 200 }}>
                <label style={{ fontSize: 9 }}>Name</label>
                <input data-bwignore style={sel} value={offMarket.name}
                  onChange={(ev) => setOffMarket({ ...offMarket, name: ev.target.value })} />
              </div>
              <div className="f" style={{ minWidth: 220, flex: 1 }}>
                <label style={{ fontSize: 9 }}>Their site</label>
                <input data-bwignore style={sel} value={offMarket.url}
                  onChange={(ev) => setOffMarket({ ...offMarket, url: ev.target.value })} />
              </div>
              <div className="f" style={{ minWidth: 160 }}>
                <label style={{ fontSize: 9 }}>Where</label>
                <input data-bwignore style={sel} value={offMarket.where}
                  onChange={(ev) => setOffMarket({ ...offMarket, where: ev.target.value })} />
              </div>
              <button className="btn quiet" disabled={pending || !offMarket.name.trim()}
                onClick={() => act(async () => {
                  const r = await addOffMarket(e.id, offMarket.name, offMarket.url, offMarket.where);
                  if (r.ok) setOffMarket({ name: '', url: '', where: '' });
                  return r;
                })}>Add</button>
            </div>
          </div>
        </>
      )}

      {step === 'Ready to present' && (
        <div className="sect">
          <h3>Where it goes next</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            {e.shortlist.length} venue{e.shortlist.length === 1 ? '' : 's'} shortlisted
            {e.offMarket.length ? `, ${e.offMarket.length} found off market` : ''}
          </div>

          <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
            {[
              ['Searching', 'Back to searching'],
              ['With the host', 'Send it to them'],
              ['Accepted', 'They chose one'],
              ['With the venue', 'Ask the venue'],
              ['Looking further afield', 'Nothing fits — go to market'],
              ['Declined', 'They said no'],
            ].map(([status, label]) => (
              <button key={status} className="btn quiet" disabled={pending}
                onClick={() => act(async () => {
                  const r = await moveTo(e.id, status);
                  if (r.ok) router.refresh();
                  return r;
                })}>{label}</button>
            ))}
          </div>

          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            Sending it to them sets an answer due in seven days; asking a venue sets two. An
            enquiry sitting with somebody for three weeks should read as that rather than as an
            old enquiry.
          </div>
        </div>
      )}
    </>
  );
}
