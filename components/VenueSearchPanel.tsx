'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import {
  deleteSavedSearch, runAdvancedSearch, saveSearch, type SearchParams,
} from '@/app/actions/search';
import GeographyFilter from './GeographyFilter';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;
type Options = Record<string, Row[]>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '7px 9px', width: '100%', fontSize: 13,
};

/** The same search, wherever it is needed.
 *  `onPick` decides what a result button does — shortlist it against an
 *  enquiry, save it to a contact, or nothing at all when browsing. The
 *  filters are identical in every case, which is the point: a search that
 *  behaves differently depending on where you opened it is two searches. */
export default function VenueSearchPanel({
  options, saved, compact, pickLabel, onPick, alreadyPicked,
}: {
  options: Options;
  saved: Row[];
  compact?: boolean;
  pickLabel?: string;
  onPick?: (venueId: number, venueName: string) => void | Promise<void>;
  alreadyPicked?: number[];
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();

  const [p, setP] = useState<SearchParams>({ p_sort: 'name', p_limit: 50, p_offset: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [saveName, setSaveName] = useState('');
  const [savedList, setSavedList] = useState(saved);
  const [open, setOpen] = useState<string | null>('where');

  const set = (k: string, v: unknown) =>
    setP((prev) => ({ ...prev, [k]: v, p_offset: 0 }));

  const toggleIn = (k: string, id: number) =>
    setP((prev) => {
      const cur = (prev[k] as number[]) ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...prev, [k]: next.length ? next : null, p_offset: 0 };
    });

  const has = (k: string, id: number) => ((p[k] as number[]) ?? []).includes(id);

  const run = (override?: SearchParams) => start(async () => {
    report('saving');
    const res = await runAdvancedSearch(override ?? p);
    if (res.ok) { setRows(res.rows); setTotal(res.total); setErr(''); report('saved'); }
    else { setErr(res.error); report('error', 'Failed'); }
  });

  // Run once on mount so the screen opens with something rather than blank.
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const activeCount = Object.entries(p).filter(([k, v]) =>
    !['p_sort', 'p_limit', 'p_offset'].includes(k) &&
    v !== null && v !== undefined && v !== '' &&
    !(Array.isArray(v) && !v.length)).length;

  const Section = ({ id, title, children, note }: {
    id: string; title: string; children: React.ReactNode; note?: string;
  }) => (
    <div className="row-card" style={{ marginBottom: 'var(--s3)' }}>
      <header>
        <div>
          <div className="rt" style={{ fontSize: 17 }}>{title}</div>
          {note && <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)' }}>{note}</div>}
        </div>
        <button className="link-btn" onClick={() => setOpen(open === id ? null : id)}>
          {open === id ? 'Close' : 'Open'}
        </button>
      </header>
      {open === id && children}
    </div>
  );

  const Pills = ({ k, items }: { k: string; items: Row[] }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {items.map((i) => (
        <button key={i.id} type="button" className={`pill ${has(k, i.id) ? 'gold' : ''}`}
          style={{ cursor: 'pointer', background: has(k, i.id) ? undefined : 'var(--warm-white)' }}
          onClick={() => toggleIn(k, i.id)}>{i.name ?? i.label}</button>
      ))}
    </div>
  );

  const Tri = ({ k, label }: { k: string; label: string }) => (
    <div className="f">
      <label>{label}</label>
      <div className="tri">
        <button type="button" className={p[k] === true ? 'on' : ''}
                onClick={() => set(k, p[k] === true ? null : true)}>Yes</button>
        <button type="button" className={p[k] === false ? 'on' : ''}
                onClick={() => set(k, p[k] === false ? null : false)}>No</button>
        <button type="button" className={p[k] === null || p[k] === undefined ? 'on unk' : ''}
                onClick={() => set(k, null)}>Any</button>
      </div>
    </div>
  );

  const Num = ({ k, label, help }: { k: string; label: string; help?: string }) => (
    <div className="f">
      <label>{label}</label>
      <input type="number" data-bwignore style={sel} value={(p[k] as any) ?? ''}
             onChange={(e) => set(k, e.target.value === '' ? null : Number(e.target.value))} />
      {help && <span className="help">{help}</span>}
    </div>
  );

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    compact ? <>{children}</> : <div className="content">{children}</div>;

  return (
    <Wrapper>
      <div className="ph">
        <div>
          <h2 style={compact ? { fontSize: 24 } : undefined}>
            {compact ? 'Find venues' : 'Advanced search'}</h2>
          <div className="ph-sub">
            {total === null ? 'Searching…' : `${total.toLocaleString('en-AU')} venues`}
            {activeCount > 0 && ` · ${activeCount} filter${activeCount === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" disabled={pending}
                  onClick={() => { setP({ p_sort: 'name', p_limit: 50, p_offset: 0 }); run({ p_sort: 'name', p_limit: 50 }); }}>
            Clear
          </button>
          <button className="btn" disabled={pending} onClick={() => run()}>Search</button>
        </div>
      </div>

      <div className="note">
        <strong>Every condition is optional and they stack.</strong></div>

      {err && <div className="note bad">{err}</div>}

      <div style={{ display: 'grid',
                    gridTemplateColumns: compact ? '300px 1fr' : '340px 1fr',
                    gap: 'var(--s5)', alignItems: 'start' }}>
        {/* ── filters ─────────────────────────────────────────── */}
        <div>
          <div className="f" style={{ marginBottom: 'var(--s3)' }}>
            <label htmlFor="txt">Name contains</label>
            <input id="txt" data-bwignore style={sel} value={(p.p_text as string) ?? ''}
                   onChange={(e) => set('p_text', e.target.value || null)}
                   onKeyDown={(e) => e.key === 'Enter' && run()} />
          </div>

          <Section id="where" title="Where"
                   note="Each level narrows the next">
            <GeographyFilter
              continents={options.continents}
              countries={options.countries}
              value={p as any}
              onChange={(patch) => setP((prev) => ({ ...prev, ...patch, p_offset: 0 }))}
            />
          </Section>

          <Section id="what" title="What it is">
            <div className="f" style={{ marginBottom: 'var(--s3)' }}>
              <label>Category</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {['Retreat', 'Wellness'].map((c) => {
                  const on = ((p.p_category as string[]) ?? []).includes(c);
                  return (
                    <button key={c} type="button" className={`pill ${on ? 'gold' : ''}`}
                      style={{ cursor: 'pointer', background: on ? undefined : 'var(--warm-white)' }}
                      onClick={() => {
                        const cur = (p.p_category as string[]) ?? [];
                        const next = on ? cur.filter((x) => x !== c) : [...cur, c];
                        set('p_category', next.length ? next : null);
                      }}>{c}</button>
                  );
                })}
              </div>
            </div>
            <div className="f" style={{ marginBottom: 'var(--s3)' }}>
              <label>Venue type</label>
              <Pills k="p_venue_type_ids" items={options.types} />
            </div>
            <div className="f">
              <label>Hire type</label>
              <Pills k="p_hire_type_ids" items={options.hireTypes} />
            </div>
          </Section>

          <Section id="practices" title="Practices"
                   note="Choose any of, or require all of">
            <div style={{ marginBottom: 'var(--s3)' }}>
              <button type="button" className={`pill ${p.p_practice_all ? 'gold' : ''}`}
                style={{ cursor: 'pointer',
                         background: p.p_practice_all ? undefined : 'var(--warm-white)' }}
                onClick={() => set('p_practice_all', !p.p_practice_all)}>
                {p.p_practice_all ? 'Must have ALL selected' : 'Any of the selected'}
              </button>
            </div>
            <div className="f" style={{ marginBottom: 'var(--s3)' }}>
              <label>Category</label>
              <Pills k="p_modality_cat_ids" items={options.categories} />
            </div>
            <div className="f">
              <label>Practice</label>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Pills k="p_practice_ids" items={options.practices} />
              </div>
            </div>
          </Section>

          <Section id="facilities" title="Facilities"
                   note="Choose any of, or require all of">
            <div style={{ marginBottom: 'var(--s3)' }}>
              <button type="button" className={`pill ${p.p_facility_all ? 'gold' : ''}`}
                style={{ cursor: 'pointer',
                         background: p.p_facility_all ? undefined : 'var(--warm-white)' }}
                onClick={() => set('p_facility_all', !p.p_facility_all)}>
                {p.p_facility_all ? 'Must have ALL selected' : 'Any of the selected'}
              </button>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <Pills k="p_facility_ids" items={options.facilities} />
            </div>
          </Section>

          <Section id="size" title="Size and price">
            <div className="grid">
              <Num k="p_guests_min" label="Guests from" />
              <Num k="p_guests_max" label="Guests to" />
              <Num k="p_bedrooms_min" label="Bedrooms from" />
              <Num k="p_ensuites_min" label="Ensuites from" />
              <Num k="p_price_min" label="Price from" />
              <Num k="p_price_max" label="Price to" />
            </div>
          </Section>

          <Section id="policy" title="Policy and access">
            <div className="grid">
              <Tri k="p_children_allowed" label="Children" />
              <Tri k="p_pets_allowed" label="Pets" />
              <Tri k="p_has_access_restriction" label="Access restriction" />
              <Tri k="p_permits_ceremony" label="Permits ceremony" />
              <Tri k="p_permits_plant_medicine" label="Permits plant medicine" />
              <Tri k="p_wheelchair" label="Wheelchair access" />
            </div>
          </Section>

          <Section id="hosting" title="What a host may bring">
            <div className="grid">
              <Tri k="p_byo_facilitator" label="Own facilitators" />
              <Tri k="p_external_practitioners" label="External practitioners" />
              <Tri k="p_byo_chef" label="Own chef" />
              <Tri k="p_self_catering" label="Self-catering" />
              <Tri k="p_chef_available" label="Chef available" />
              <Tri k="p_wifi" label="WiFi" />
            </div>
          </Section>

          <Section id="who" title="Outcomes and audience">
            <div className="f" style={{ marginBottom: 'var(--s3)' }}>
              <label>Outcome</label>
              <Pills k="p_outcome_ids" items={options.outcomes} />
            </div>
            <div className="f">
              <label>Audience</label>
              <Pills k="p_audience_ids" items={options.audiences} />
            </div>
          </Section>

          <Section id="internal" title="Commercial and completeness">
            <div className="f" style={{ marginBottom: 'var(--s3)' }}>
              <label>Subscription tier</label>
              <Pills k="p_tier_ids" items={options.tiers} />
            </div>
            <div className="grid">
              <Tri k="p_is_listed" label="Published listing" />
              <Tri k="p_has_media" label="Has media" />
              <Tri k="p_has_coords" label="Has coordinates" />
            </div>
          </Section>

          {!compact && <div className="row-card" style={{ marginBottom: 'var(--s3)' }}>
            <header><div className="rt" style={{ fontSize: 17 }}>Saved searches</div></header>
            <div style={{ display: 'flex', gap: 'var(--s2)', marginBottom: 'var(--s3)' }}>
              <input data-bwignore placeholder="Name this search" style={sel}
                     value={saveName} onChange={(e) => setSaveName(e.target.value)} />
              <button className="btn quiet" disabled={pending || !saveName.trim()}
                onClick={() => start(async () => {
                  const res = await saveSearch(saveName, p);
                  if (res.ok) {
                    setSavedList([{ id: Date.now(), name: saveName, params: p }, ...savedList]);
                    setSaveName('');
                  }
                })}>Save</button>
            </div>
            {!savedList.length && (
              <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>None saved yet.</div>
            )}
            {savedList.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between',
                                       alignItems: 'center', padding: '4px 0' }}>
                <button className="link-btn"
                  onClick={() => { setP(s.params); run(s.params); }}>{s.name}</button>
                <button className="link-btn" disabled={pending}
                  onClick={() => start(async () => {
                    await deleteSavedSearch(s.id);
                    setSavedList(savedList.filter((x) => x.id !== s.id));
                  })}>Remove</button>
              </div>
            ))}
          </div>}
        </div>

        {/* ── results ─────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 'var(--s3)' }}>
            <div className="f" style={{ maxWidth: 200 }}>
              <label htmlFor="srt">Sort</label>
              <select id="srt" style={sel} value={(p.p_sort as string) ?? 'name'}
                onChange={(e) => { const v = e.target.value;
                  setP((prev) => ({ ...prev, p_sort: v })); run({ ...p, p_sort: v }); }}>
                <option value="name">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
                <option value="guests">Largest capacity</option>
                <option value="price_asc">Price lowest</option>
                <option value="price_desc">Price highest</option>
                <option value="recent">Recently updated</option>
              </select>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
              {rows.length} shown{total ? ` of ${total.toLocaleString('en-AU')}` : ''}
            </span>
          </div>

          {!rows.length && total === 0 && (
            <div className="note bad" style={{ marginBottom: 0 }}>
              <strong>Nothing matched.</strong> If this was a real requirement, it is a supply gap
              worth recording against the enquiry — demand that exists and cannot be filled.
            </div>
          )}

          {!!rows.length && (
            <table>
              <thead>
                <tr>
                  <th>Venue</th><th>Where</th><th>Type</th>
                  <th>Guests</th><th>From</th><th>Depth</th>
                  {onPick && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/venues/${r.id}/details`} style={{ textDecoration: 'none' }}>
                        <div className="v-name">{r.venue_name}</div>
                        <div className="v-slug">{r.category_label ?? 'Category unset'}</div>
                      </Link>
                    </td>
                    <td className="v-slug">
                      {[r.city_name, r.state_name, r.country_name].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="v-slug">{r.venue_type_name ?? '—'}</td>
                    <td>{r.max_guests ?? '—'}</td>
                    <td className="v-slug">{r.price_from ?? '—'}</td>
                    <td className="v-slug">
                      {r.practice_count}p · {r.facility_count}f · {r.media_count}m
                    </td>
                    {onPick && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {(alreadyPicked ?? []).includes(r.id)
                          ? <span className="pill empty">Added</span>
                          : <button className="link-btn" disabled={pending}
                              onClick={() => onPick(r.id, r.venue_name)}>
                              {pickLabel ?? 'Add'}
                            </button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {total !== null && total > rows.length && (
            <div style={{ marginTop: 'var(--s4)' }}>
              <button className="btn quiet" disabled={pending}
                onClick={() => {
                  const next = { ...p, p_limit: ((p.p_limit as number) ?? 50) + 50 };
                  setP(next); run(next);
                }}>Show more</button>
            </div>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
