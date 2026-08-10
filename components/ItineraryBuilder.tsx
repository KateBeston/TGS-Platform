'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  addItem, addServiceItem, nearbyServices, removeItem, saveItem, saveItinerary,
} from '@/app/actions/itineraries';
import DateConflictAlert from './DateConflictAlert';
import { useSaveState } from './SaveState';
import TimeSelect, { readable } from './TimeSelect';

type Row = Record<string, any>;

const ITEM_TYPES = ['Service', 'Practice', 'Excursion', 'Meal', 'Transfer',
  'Free time', 'Arrival', 'Departure', 'Ceremony', 'Other'];
const BOOKING_STATUS = ['Idea', 'Requested', 'Held', 'Confirmed', 'Declined', 'Cancelled'];
const STATUSES = ['Draft', 'Proposed', 'Confirmed', 'In progress', 'Complete', 'Cancelled'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

/** Builds the list of dates the itinerary covers. An itinerary without
 *  dates cannot have days, so it says so rather than rendering nothing. */
function dateRange(from: string | null, to: string | null): string[] {
  if (!from) return [];
  const out: string[] = [];
  const start = new Date(from);
  const end = new Date(to || from);
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out.slice(0, 60);
}

export default function ItineraryBuilder({
  itinerary, items, days, baseServices,
}: { itinerary: Row; items: Row[]; days: Row[]; baseServices: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [list, setList] = useState(items);
  const [picker, setPicker] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Row[]>([]);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  const dates = dateRange(itinerary.date_from, itinerary.date_to);
  const dayFor = (d: string) => days.find((x) => x.item_date === d);
  const itemsFor = (d: string) => list.filter((i) => i.item_date === d);
  const baseName = itinerary.venues?.venue_name;
  const countryCode = itinerary.venues?.countries?.iso_code ?? null;

  const total = list
    .filter((i) => !i.is_included)
    .reduce((s, i) => s + Number(i.price_total ?? (i.price_per_person ?? 0) * (i.participant_count ?? itinerary.guest_count ?? 1)), 0);

  const offsiteVenueIds = Array.from(new Set(
    list.filter((i) => i.venue_id && i.venue_id !== itinerary.base_venue_id)
        .map((i) => i.venue_id as number)));

  const search = (date: string) => start(async () => {
    const r = await nearbyServices(itinerary.base_venue_id ?? null, q, itinerary.venues?.country_id);
    setResults(r); setPicker(date);
  });

  return (
    <>
      <div className="ph">
        <div>
          <h2>{itinerary.name}</h2>
          <div className="ph-sub">
            {baseName ? `Based at ${baseName}` : 'No base venue set'}
            {itinerary.guest_count && ` · ${itinerary.guest_count} guests`}
            {dates.length > 0 && ` · ${dates.length} day${dates.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="ph-act">
          <Link className="btn quiet" href={`/itineraries/${itinerary.id}/print`}>
            Print &amp; export
          </Link>
          <select defaultValue={itinerary.status} style={{ ...sel, width: 'auto' }}
            onChange={(e) => act(() => saveItinerary(itinerary.id, 'status', e.target.value))}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="note">
        <strong>Anything inside the window, wherever it happens.</strong></div>

      {!dates.length && (
        <div className="note bad">
          <strong>No dates set.</strong> An itinerary needs a window before it can have days.
        </div>
      )}

      <div className="sect">
        <div className="grid">
          <div className="f">
            <label>From</label>
            <input type="date" data-bwignore style={sel} defaultValue={itinerary.date_from ?? ''}
              onBlur={(e) => act(() => saveItinerary(itinerary.id, 'date_from', e.target.value || null))} />
          </div>
          <div className="f">
            <label>To</label>
            <input type="date" data-bwignore style={sel} defaultValue={itinerary.date_to ?? ''}
              onBlur={(e) => act(() => saveItinerary(itinerary.id, 'date_to', e.target.value || null))} />
          </div>
          <div className="f">
            <label>Guests</label>
            <input type="number" data-bwignore style={sel} defaultValue={itinerary.guest_count ?? ''}
              onBlur={(e) => act(() => saveItinerary(itinerary.id, 'guest_count',
                e.target.value ? Number(e.target.value) : null))} />
          </div>
          <div className="f">
            <label>Total, excluding included items</label>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, paddingTop: 2 }}>
              {total ? `AUD ${total.toLocaleString('en-AU')}` : '—'}
            </div>
          </div>
        </div>

        <DateConflictAlert
          dateFrom={itinerary.date_from} dateTo={itinerary.date_to}
          countryCode={countryCode}
          venueIds={[itinerary.base_venue_id, ...offsiteVenueIds].filter(Boolean) as number[]} />
      </div>

      {dates.map((d, dayIndex) => {
        const dayItems = itemsFor(d);
        const summary = dayFor(d);
        return (
          <div className="sect" key={d}>
            <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
              <div>
                <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
                  Day {dayIndex + 1}
                </h3>
                <div className="ph-sub">
                  {new Date(d).toLocaleDateString('en-AU',
                    { weekday: 'long', day: 'numeric', month: 'long' })}
                  {summary && ` · ${summary.items} item${summary.items === 1 ? '' : 's'}`}
                  {(summary?.offsite_items ?? 0) > 0 && ` · ${summary!.offsite_items} off site`}
                  {(summary?.unconfirmed ?? 0) > 0 && (
                    <span style={{ color: 'var(--warn)' }}>
                      {' '}· {summary!.unconfirmed} unconfirmed
                    </span>
                  )}
                </div>
              </div>
              <div className="ph-act">
                <button className="btn quiet" disabled={pending}
                  onClick={() => act(async () => {
                    const res = await addItem(itinerary.id, d);
                    if (res.ok) setList([...list, { id: res.id, item_date: d,
                      item_type: 'Service', title: 'New item', booking_status: 'Idea' }]);
                    return res;
                  })}>Add item</button>
                <button className="btn quiet" disabled={pending}
                  onClick={() => { setResults([]); setQ(''); search(d); }}>
                  Find a service
                </button>
              </div>
            </div>

            {picker === d && (
              <div style={{ border: '1px solid var(--border)', background: 'var(--warm-cream)',
                            padding: 'var(--s4)', marginBottom: 'var(--s4)' }}>
                <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                              marginBottom: 'var(--s3)' }}>
                  <div className="f" style={{ flex: 1 }}>
                    <label>Search services</label>
                    <input data-bwignore style={sel} value={q} placeholder="Massage, sauna, sound bath"
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && search(d)} />
                  </div>
                  <button className="btn quiet" disabled={pending} onClick={() => search(d)}>
                    Search
                  </button>
                  <button className="link-btn" onClick={() => setPicker(null)}>Close</button>
                </div>

                {!results.length && (
                  <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                    Nothing found. Services must be recorded against a venue before they can be
                    added here.
                  </div>
                )}

                {!!results.length && (
                  <table>
                    <thead>
                      <tr><th>Service</th><th>Venue</th><th>Distance</th>
                          <th>Duration</th><th>From</th><th></th></tr>
                    </thead>
                    <tbody>
                      {results.map((r: any) => (
                        <tr key={r.id}>
                          <td>{r.website_display_name || r.name}</td>
                          <td className="v-slug">
                            {r.venues?.venue_name}
                            {r.venues?.cities?.name && ` · ${r.venues.cities.name}`}
                            {r.venue_id === itinerary.base_venue_id && (
                              <span className="pill" style={{ marginLeft: 4 }}>Base</span>
                            )}
                          </td>
                          <td className="v-slug">
                            {r.distance_km === 0 ? 'On site'
                              : Number.isFinite(r.distance_km) ? `${r.distance_km} km` : '—'}
                          </td>
                          <td>{r.duration_minutes ? `${r.duration_minutes} min` : '—'}</td>
                          <td className="v-slug">
                            {r.base_price ? `${r.currency ?? 'AUD'} ${r.base_price}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="link-btn" disabled={pending}
                              onClick={() => act(async () => {
                                const res = await addServiceItem(itinerary.id, d, r.id, null);
                                if (res.ok) {
                                  setList([...list, { id: res.id, item_date: d,
                                    item_type: 'Service',
                                    title: r.website_display_name || r.name,
                                    venue_id: r.venue_id, service_id: r.id,
                                    duration_minutes: r.duration_minutes,
                                    price_per_person: r.base_price,
                                    booking_status: 'Idea',
                                    venues: { venue_name: r.venues?.venue_name } }]);
                                  setPicker(null);
                                }
                                return res;
                              })}>Add</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {!dayItems.length && (
              <div style={{ padding: 'var(--s4)', border: '1px dashed var(--border-input)',
                            color: 'var(--ink-quiet)', fontSize: 12.5, textAlign: 'center' }}>
                Nothing planned
              </div>
            )}

            {dayItems.map((it) => (
              <ItemCard key={it.id} item={it} itineraryId={itinerary.id}
                        baseVenueId={itinerary.base_venue_id}
                        guestCount={itinerary.guest_count}
                        act={act} pending={pending}
                        onRemove={() => setList(list.filter((x) => x.id !== it.id))} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function ItemCard({
  item, itineraryId, baseVenueId, guestCount, act, pending, onRemove,
}: {
  item: Row; itineraryId: number; baseVenueId: number | null;
  guestCount: number | null; pending: boolean;
  act: (fn: () => Promise<any>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const save = (col: string, v: unknown) => act(() => saveItem(item.id, itineraryId, col, v));
  const offsite = item.venue_id && item.venue_id !== baseVenueId;

  return (
    <div className="row-card" style={{ marginBottom: 'var(--s2)',
      borderLeft: item.booking_status === 'Confirmed'
        ? '3px solid var(--ok)'
        : offsite ? '3px solid var(--gold)' : undefined }}>
      <header>
        <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'baseline' }}>
          <div style={{ fontVariantNumeric: 'tabular-nums', minWidth: 90,
                        fontSize: 13, color: 'var(--ink-quiet)' }}>
            {item.is_all_day ? 'All day'
              : item.starts_at
                ? readable(String(item.starts_at).slice(0, 5))
                : 'No time'}
          </div>
          <div>
            <div className="rt" style={{ fontSize: 17 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
              {item.item_type}
              {item.duration_minutes && ` · ${item.duration_minutes} min`}
              {offsite && item.venues?.venue_name && (
                <span style={{ color: 'var(--ink-gold)' }}> · at {item.venues.venue_name}</span>
              )}
              {item.travel_minutes_to_next && ` · ${item.travel_minutes_to_next} min travel after`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
          <select defaultValue={item.booking_status} disabled={pending}
            style={{ ...sel, width: 'auto' }}
            onChange={(e) => save('booking_status', e.target.value)}>
            {BOOKING_STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="link-btn" onClick={() => setOpen(!open)}>
            {open ? 'Close' : 'Edit'}
          </button>
          <button className="link-btn" disabled={pending}
            onClick={() => act(async () => {
              const res = await removeItem(item.id, itineraryId);
              if (res.ok) onRemove();
              return res;
            })}>Remove</button>
        </div>
      </header>

      {open && (
        <>
          <div className="grid">
            <div className="f">
              <label>Title</label>
              <input data-bwignore style={sel} defaultValue={item.title}
                onBlur={(e) => e.target.value !== item.title && save('title', e.target.value)} />
            </div>
            <div className="f">
              <label>Type</label>
              <select defaultValue={item.item_type} style={sel}
                onChange={(e) => save('item_type', e.target.value)}>
                {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="f">
              <label>Starts</label>
              <TimeSelect value={item.starts_at ?? null} placeholder="No fixed time"
                onChange={(v) => save('starts_at', v)} />
            </div>
            <div className="f">
              <label>Duration (minutes)</label>
              <input type="number" data-bwignore style={sel}
                defaultValue={item.duration_minutes ?? ''}
                onBlur={(e) => save('duration_minutes',
                  e.target.value ? Number(e.target.value) : null)} />
              <span className="help">End time follows from this</span>
            </div>
            <div className="f">
              <label>Participants</label>
              <input type="number" data-bwignore style={sel}
                defaultValue={item.participant_count ?? ''}
                placeholder={guestCount ? String(guestCount) : ''}
                onBlur={(e) => save('participant_count',
                  e.target.value ? Number(e.target.value) : null)} />
              <span className="help">Blank means everyone</span>
            </div>
            <div className="f">
              <label>Travel to the next item (minutes)</label>
              <input type="number" data-bwignore style={sel}
                defaultValue={item.travel_minutes_to_next ?? ''}
                onBlur={(e) => save('travel_minutes_to_next',
                  e.target.value ? Number(e.target.value) : null)} />
              <span className="help">Real time, not what a map says</span>
            </div>
            <div className="f">
              <label>Price per person</label>
              <input type="number" data-bwignore style={sel}
                defaultValue={item.price_per_person ?? ''}
                onBlur={(e) => save('price_per_person',
                  e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="f">
              <label>Payable to</label>
              <select defaultValue={item.payable_to ?? ''} style={sel}
                onChange={(e) => save('payable_to', e.target.value || null)}>
                <option value="">Not decided</option>
                {['TGS', 'Venue', 'Provider', 'Guest'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
            <div className="f">
              <label>Description</label>
              <textarea data-bwignore defaultValue={item.description ?? ''}
                onBlur={(e) => save('description', e.target.value || null)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s3)',
                        flexWrap: 'wrap' }}>
            <button type="button" disabled={pending}
              className={`pill ${item.is_included ? 'gold' : ''}`}
              style={{ cursor: 'pointer',
                       background: item.is_included ? undefined : 'var(--warm-white)' }}
              onClick={() => save('is_included', !item.is_included)}>
              {item.is_included ? 'Included in the package' : 'Charged separately'}
            </button>
            <button type="button" disabled={pending}
              className={`pill ${item.is_optional ? 'gold' : ''}`}
              style={{ cursor: 'pointer',
                       background: item.is_optional ? undefined : 'var(--warm-white)' }}
              onClick={() => save('is_optional', !item.is_optional)}>
              {item.is_optional ? 'Optional' : 'For everyone'}
            </button>
            <button type="button" disabled={pending}
              className={`pill ${item.is_all_day ? 'gold' : ''}`}
              style={{ cursor: 'pointer',
                       background: item.is_all_day ? undefined : 'var(--warm-white)' }}
              onClick={() => save('is_all_day', !item.is_all_day)}>
              All day
            </button>
            {offsite && (
              <Link className="link-btn" href={`/venues/${item.venue_id}/scheduling`}
                    style={{ alignSelf: 'center' }}>
                That venue's hours
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
