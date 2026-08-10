'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  addBreak, addClosure, removeBreak, removeClosure, removeHolidayOverride,
  saveBreak, saveClosure, saveScheduling, setHolidayOverride,
} from '@/app/actions/scheduling';
import { useSaveState } from './SaveState';
import TimeSelect, { readable } from './TimeSelect';

type Row = Record<string, any>;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BREAK_TYPES = ['Lunch', 'Changeover', 'Cleaning', 'Staff', 'Break', 'Other'];
const HOLIDAY_POLICIES = ['Assumed closed', 'Closed', 'Open', 'Reduced hours', 'Varies'];
const OVERRIDE_STATUS = ['Open', 'Closed', 'Reduced hours', 'By appointment'];
const CLOSURE_TYPES = ['Closed', 'Reduced hours', 'Private event', 'Maintenance', 'Seasonal'];
const HOURS_APPLY = [
  ['Appointments', 'Bookings must fall inside opening hours'],
  ['Reception', 'Hours are when staff are present; a stay continues outside them'],
  ['Both', 'Appointments are bound by hours, stays are not'],
] as const;
const ACCESS_METHODS = ['24 hour front desk', 'Staffed hours only', 'Lockbox',
  'Keypad or smart lock', 'On-site manager', 'Meet on arrival', 'Caretaker nearby', 'Other'];
const STAFFING = ['24 hour staffed', 'On-site overnight', 'On-call nearby',
  'Daytime only', 'Unstaffed'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '7px 9px', width: '100%', fontSize: 13,
};

export default function SchedulingEditor({
  venueId, countryCode, countryName, scheduling, breaks, services,
  holidays, overrides, closures,
}: {
  venueId: number; countryCode: string | null; countryName: string | null;
  scheduling: Row | null; breaks: Row[]; services: Row[];
  holidays: Row[]; overrides: Row[]; closures: Row[];
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const s = scheduling ?? {};
  const [policy, setPolicy] = useState(s.public_holiday_policy ?? 'Assumed closed');
  const [breakList, setBreakList] = useState(breaks);
  const [closureList, setClosureList] = useState(closures);
  const [ovs, setOvs] = useState(overrides);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  const save = (col: string, v: unknown) => act(() => saveScheduling(venueId, col, v));
  const assumed = policy === 'Assumed closed';

  const ovFor = (name: string) => ovs.find((o) => o.holiday_name === name);

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Scheduling</h2>
          <div className="ph-sub">
            How appointments fit together, and when the venue is not available
          </div>
        </div>
      </div>

      {/* ── what the hours mean ───────────────────────────────── */}
      <div className="sect">
        <h3>Access and staffing</h3>

        <div className="note">
          <strong>Opening hours mean different things depending on what is being booked.</strong></div>

        <div className="grid">
          <div className="f">
            <label>Hours apply to</label>
            <select defaultValue={s.hours_apply_to ?? 'Both'} style={sel}
              onChange={(e) => save('hours_apply_to', e.target.value)}>
              {HOURS_APPLY.map(([v]) => <option key={v} value={v}>{v}</option>)}
            </select>
            <span className="help">
              {HOURS_APPLY.find(([v]) => v === (s.hours_apply_to ?? 'Both'))?.[1]}
            </span>
          </div>

          <div className="f">
            <label>Overnight access</label>
            <div className="tri">
              <button type="button" className={s.overnight_access === true ? 'on' : ''}
                onClick={() => save('overnight_access', true)}>Yes</button>
              <button type="button" className={s.overnight_access === false ? 'on' : ''}
                onClick={() => save('overnight_access', false)}>No</button>
              <button type="button"
                className={s.overnight_access == null ? 'on unk' : ''}
                onClick={() => save('overnight_access', null)}>Unknown</button>
            </div>
            <span className="help">Does a multi-day booking continue through closing time</span>
          </div>

          <div className="f">
            <label>Arrival and key collection</label>
            <select defaultValue={s.access_method ?? ''} style={sel}
              onChange={(e) => save('access_method', e.target.value || null)}>
              <option value="">Not recorded</option>
              {ACCESS_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="f">
            <label>Staffing</label>
            <select defaultValue={s.staffing_model ?? ''} style={sel}
              onChange={(e) => save('staffing_model', e.target.value || null)}>
              <option value="">Not recorded</option>
              {STAFFING.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="f">
            <label>Staff on site from</label>
            <TimeSelect value={s.staff_on_site_from ?? null} placeholder="Not set"
              onChange={(v) => save('staff_on_site_from', v)} />
          </div>
          <div className="f">
            <label>Staff on site until</label>
            <TimeSelect value={s.staff_on_site_until ?? null} placeholder="Not set"
              onChange={(v) => save('staff_on_site_until', v)} />
          </div>
        </div>

        <div className="grid one" style={{ marginTop: 'var(--s4)' }}>
          <div className="f">
            <label>Access notes</label>
            <textarea data-bwignore defaultValue={s.access_notes ?? ''}
              placeholder="Lockbox code sent 24 hours ahead, gate closes at 10pm, and so on"
              onBlur={(e) => save('access_notes', e.target.value || null)} />
          </div>
        </div>

        <div style={{ marginTop: 'var(--s5)' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                        color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>
            What happens at 2am
          </div>
          <div className="grid">
            <div className="f">
              <label>Emergency contact available</label>
              <div className="tri">
                <button type="button" className={s.emergency_contact_available === true ? 'on' : ''}
                  onClick={() => save('emergency_contact_available', true)}>Yes</button>
                <button type="button" className={s.emergency_contact_available === false ? 'on' : ''}
                  onClick={() => save('emergency_contact_available', false)}>No</button>
                <button type="button"
                  className={s.emergency_contact_available == null ? 'on unk' : ''}
                  onClick={() => save('emergency_contact_available', null)}>Unknown</button>
              </div>
              <span className="help">The question every retreat host asks</span>
            </div>
            <div className="f">
              <label>Nearest staff (minutes away)</label>
              <input type="number" data-bwignore style={sel}
                defaultValue={s.nearest_staff_distance_minutes ?? ''}
                onBlur={(e) => save('nearest_staff_distance_minutes',
                  e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>
          <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
            <div className="f">
              <label>Emergency arrangements</label>
              <textarea data-bwignore defaultValue={s.emergency_response_notes ?? ''}
                onBlur={(e) => save('emergency_response_notes', e.target.value || null)} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--s5)' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                        color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>
            Arrival and departure
          </div>
          <div className="grid">
            <div className="f">
              <label>After-hours arrival permitted</label>
              <div className="tri">
                <button type="button" className={s.after_hours_arrival_permitted === true ? 'on' : ''}
                  onClick={() => save('after_hours_arrival_permitted', true)}>Yes</button>
                <button type="button" className={s.after_hours_arrival_permitted === false ? 'on' : ''}
                  onClick={() => save('after_hours_arrival_permitted', false)}>No</button>
                <button type="button"
                  className={s.after_hours_arrival_permitted == null ? 'on unk' : ''}
                  onClick={() => save('after_hours_arrival_permitted', null)}>Unknown</button>
              </div>
            </div>
            <div className="f">
              <label>After-hours departure permitted</label>
              <div className="tri">
                <button type="button" className={s.after_hours_departure_permitted === true ? 'on' : ''}
                  onClick={() => save('after_hours_departure_permitted', true)}>Yes</button>
                <button type="button" className={s.after_hours_departure_permitted === false ? 'on' : ''}
                  onClick={() => save('after_hours_departure_permitted', false)}>No</button>
                <button type="button"
                  className={s.after_hours_departure_permitted == null ? 'on unk' : ''}
                  onClick={() => save('after_hours_departure_permitted', null)}>Unknown</button>
              </div>
            </div>
            <div className="f">
              <label>Arrival must be during hours</label>
              <div className="tri">
                <button type="button" className={s.arrival_only_during_hours ? 'on' : ''}
                  onClick={() => save('arrival_only_during_hours', true)}>Yes</button>
                <button type="button" className={!s.arrival_only_during_hours ? 'on' : ''}
                  onClick={() => save('arrival_only_during_hours', false)}>No</button>
              </div>
              <span className="help">
                Some venues will not take a booking starting on a day they are closed, even for a
                multi-day stay
              </span>
            </div>
          </div>
          <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
            <div className="f">
              <label>Arrival notes</label>
              <input data-bwignore style={sel} defaultValue={s.after_hours_arrival_notes ?? ''}
                onBlur={(e) => save('after_hours_arrival_notes', e.target.value || null)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── slots and buffers ─────────────────────────────────── */}
      <div className="sect">
        <h3>Appointment slots</h3>
        <div className="note">
          Each service carries its own duration and buffer. These are the venue defaults, used
          wherever a service does not set its own — so a venue can say "fifteen minutes between
          anything" once rather than on every treatment.
          {(s.hours_apply_to ?? 'Both') === 'Reception' && (
            <> <br /><br /><strong>Hours here are reception only</strong>, so these settings apply to
            appointments if any are offered, and do not restrict a multi-day stay.</>
          )}
        </div>

        <div className="grid">
          <div className="f">
            <label>Default buffer between services</label>
            <input type="number" data-bwignore style={sel}
              defaultValue={s.default_buffer_minutes ?? 15}
              onBlur={(e) => save('default_buffer_minutes',
                e.target.value ? Number(e.target.value) : null)} />
            <span className="help">Minutes. Applies where a service has none of its own.</span>
          </div>
          <div className="f">
            <label>Changeover between clients</label>
            <input type="number" data-bwignore style={sel}
              defaultValue={s.changeover_minutes ?? ''}
              onBlur={(e) => save('changeover_minutes',
                e.target.value ? Number(e.target.value) : null)} />
            <span className="help">Longer reset — linen, room turnaround</span>
          </div>
          <div className="f">
            <label>Back to back permitted</label>
            <div className="tri">
              <button type="button" className={s.allows_back_to_back !== false ? 'on' : ''}
                onClick={() => save('allows_back_to_back', true)}>Yes</button>
              <button type="button" className={s.allows_back_to_back === false ? 'on' : ''}
                onClick={() => save('allows_back_to_back', false)}>No</button>
            </div>
            <span className="help">The venue's call, not ours</span>
          </div>
          <div className="f">
            <label>Slot interval</label>
            <select defaultValue={s.slot_interval_minutes ?? 15} style={sel}
              onChange={(e) => save('slot_interval_minutes', Number(e.target.value))}>
              {[5, 10, 15, 20, 30, 60].map((n) => (
                <option key={n} value={n}>{n} minutes</option>
              ))}
            </select>
            <span className="help">Times offered on the hour, half hour, and so on</span>
          </div>
          <div className="f">
            <label>First appointment after opening</label>
            <input type="number" data-bwignore style={sel}
              defaultValue={s.first_appointment_offset_minutes ?? 0}
              onBlur={(e) => save('first_appointment_offset_minutes',
                e.target.value ? Number(e.target.value) : 0)} />
            <span className="help">Minutes. Setup time before the first client.</span>
          </div>
          <div className="f">
            <label>Last appointment before closing</label>
            <input type="number" data-bwignore style={sel}
              defaultValue={s.last_appointment_before_close_minutes ?? 0}
              onBlur={(e) => save('last_appointment_before_close_minutes',
                e.target.value ? Number(e.target.value) : 0)} />
            <span className="help">Minutes. So a treatment finishes before close.</span>
          </div>
        </div>

        {!!services.length && (
          <div style={{ marginTop: 'var(--s5)' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                          color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>
              Service durations
            </div>
            <table>
              <thead><tr><th>Service</th><th>Duration</th><th>Buffer</th><th>Slot total</th></tr></thead>
              <tbody>
                {services.map((sv) => {
                  const buffer = sv.buffer_minutes ?? s.default_buffer_minutes ?? 15;
                  return (
                    <tr key={sv.id}>
                      <td>{sv.name}</td>
                      <td>{sv.duration_minutes ? `${sv.duration_minutes} min` : '—'}</td>
                      <td className="v-slug">
                        {buffer} min{sv.buffer_minutes == null ? ' (default)' : ''}
                      </td>
                      <td>{sv.duration_minutes
                        ? `${sv.duration_minutes + buffer} min`
                        : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="note" style={{ marginTop: 'var(--s3)', marginBottom: 0 }}>
              Edit durations on the Services tab. Slot total is what actually consumes the diary.
            </div>
          </div>
        )}
      </div>

      {/* ── breaks ────────────────────────────────────────────── */}
      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Breaks</h3>
            <div className="ph-sub">Open, but nothing can be booked</div>
          </div>
          <div className="ph-act">
            <button className="btn quiet" disabled={pending}
              onClick={() => act(async () => {
                const res = await addBreak(venueId);
                if (res.ok) setBreakList([...breakList, { id: res.id, break_type: 'Lunch',
                  starts_at: '12:30', ends_at: '13:30' }]);
                return res;
              })}>Add a break</button>
          </div>
        </div>

        {!breakList.length && (
          <div className="note" style={{ marginBottom: 0 }}>
            None recorded. Lunch and staff changeover are the usual two — without them the diary
            will happily book straight through both.
          </div>
        )}

        {breakList.map((b) => (
          <div className="row-card" key={b.id} style={{ marginBottom: 'var(--s3)' }}>
            <header>
              <div className="rt" style={{ fontSize: 17 }}>
                {b.label || b.break_type}
                {b.starts_at && ` · ${readable(String(b.starts_at).slice(0, 5))} to ${readable(String(b.ends_at).slice(0, 5))}`}
              </div>
              <button className="link-btn" disabled={pending}
                onClick={() => act(async () => {
                  const res = await removeBreak(b.id, venueId);
                  if (res.ok) setBreakList(breakList.filter((x) => x.id !== b.id));
                  return res;
                })}>Remove</button>
            </header>
            <div className="grid">
              <div className="f">
                <label>Type</label>
                <select defaultValue={b.break_type} style={sel}
                  onChange={(e) => act(() => saveBreak(b.id, venueId, 'break_type', e.target.value))}>
                  {BREAK_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="f">
                <label>Day</label>
                <select defaultValue={b.day_of_week ?? ''} style={sel}
                  onChange={(e) => act(() => saveBreak(b.id, venueId, 'day_of_week',
                    e.target.value === '' ? null : Number(e.target.value)))}>
                  <option value="">Every day</option>
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="f">
                <label>From</label>
                <TimeSelect value={b.starts_at ?? null}
                  onChange={(v) => act(() => saveBreak(b.id, venueId, 'starts_at', v))} />
              </div>
              <div className="f">
                <label>To</label>
                <TimeSelect value={b.ends_at ?? null}
                  onChange={(v) => act(() => saveBreak(b.id, venueId, 'ends_at', v))} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── public holidays ───────────────────────────────────── */}
      <div className="sect">
        <h3>Public holidays</h3>

        <div className="note">
          <strong>The default is an assumption, not a fact.</strong></div>

        <div className="grid">
          <div className="f">
            <label>Venue policy</label>
            <select value={policy} style={sel}
              onChange={(e) => { setPolicy(e.target.value); save('public_holiday_policy', e.target.value); }}>
              {HOLIDAY_POLICIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <span className="help" style={assumed ? { color: 'var(--warn)' } : { color: 'var(--ok)' }}>
              {assumed
                ? 'Not confirmed — this is our assumption'
                : s.public_holiday_confirmed_at
                  ? `Confirmed ${new Date(s.public_holiday_confirmed_at).toLocaleDateString('en-AU')}`
                  : 'Confirmed'}
            </span>
          </div>
          <div className="f">
            <label>Notes</label>
            <input data-bwignore style={sel} defaultValue={s.public_holiday_notes ?? ''}
              onBlur={(e) => save('public_holiday_notes', e.target.value || null)} />
          </div>
        </div>

        {!countryCode && (
          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            No country set on this venue, so no holiday calendar can be shown. Set it on the
            Location tab.
          </div>
        )}

        {countryCode && !holidays.length && (
          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            No holidays loaded for {countryName ?? countryCode} yet.{' '}
            <Link href="/settings/holidays" style={{ color: 'var(--ink-gold)' }}>
              Sync them in Settings
            </Link>.
          </div>
        )}

        {!!holidays.length && (
          <>
            <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                          color: 'var(--ink-quiet)', margin: 'var(--s5) 0 var(--s3)' }}>
              {countryName ?? countryCode} · exceptions
            </div>
            <table>
              <thead>
                <tr><th>Holiday</th><th>Date</th><th>This venue</th><th>Confirmed</th><th></th></tr>
              </thead>
              <tbody>
                {holidays.map((h) => {
                  const ov = ovFor(h.name);
                  const effective = ov?.status ?? (assumed || policy === 'Closed' ? 'Closed' : policy);
                  return (
                    <tr key={h.id}>
                      <td>
                        {h.name}
                        {h.local_name && h.local_name !== h.name && (
                          <div className="v-slug">{h.local_name}</div>
                        )}
                        {h.source === 'Manual' && (
                          <span className="pill" style={{ marginLeft: 4 }}>Manual</span>
                        )}
                      </td>
                      <td className="v-slug">
                        {new Date(h.holiday_date).toLocaleDateString('en-AU',
                          { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <select value={ov?.status ?? ''} style={{ ...sel, width: 'auto' }}
                          onChange={(e) => act(async () => {
                            const v = e.target.value;
                            if (!v) {
                              const existing = ovFor(h.name);
                              if (existing?.id) {
                                const res = await removeHolidayOverride(existing.id, venueId);
                                if (res.ok) setOvs(ovs.filter((o) => o.id !== existing.id));
                                return res;
                              }
                              return { ok: true };
                            }
                            const res = await setHolidayOverride(venueId, h.id, h.name, v, false);
                            if (res.ok) {
                              setOvs([...ovs.filter((o) => o.holiday_name !== h.name),
                                      { id: Date.now(), holiday_name: h.name, status: v,
                                        is_confirmed: false }]);
                            }
                            return res;
                          })}>
                          <option value="">Follow venue policy</option>
                          {OVERRIDE_STATUS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                        {!ov && (
                          <div className="v-slug" style={{ marginTop: 2,
                            color: assumed ? 'var(--warn)' : undefined }}>
                            {effective}{assumed ? ' (assumed)' : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        {ov && (
                          <button type="button" disabled={pending}
                            className={`pill ${ov.is_confirmed ? 'gold' : ''}`}
                            style={{ cursor: 'pointer',
                                     background: ov.is_confirmed ? undefined : 'var(--warm-white)' }}
                            onClick={() => act(async () => {
                              const res = await setHolidayOverride(
                                venueId, h.id, h.name, ov.status, !ov.is_confirmed);
                              if (res.ok) setOvs(ovs.map((o) =>
                                o.holiday_name === h.name
                                  ? { ...o, is_confirmed: !ov.is_confirmed } : o));
                              return res;
                            })}>
                            {ov.is_confirmed ? 'Confirmed' : 'Assumed'}
                          </button>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── closures ──────────────────────────────────────────── */}
      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Closures</h3>
            <div className="ph-sub">Specific dates, unrelated to holidays</div>
          </div>
          <div className="ph-act">
            <button className="btn quiet" disabled={pending}
              onClick={() => act(async () => {
                const res = await addClosure(venueId);
                const today = new Date().toISOString().slice(0, 10);
                if (res.ok) setClosureList([...closureList,
                  { id: res.id, date_from: today, date_to: today, closure_type: 'Closed' }]);
                return res;
              })}>Add a closure</button>
          </div>
        </div>

        {!closureList.length && (
          <div className="note" style={{ marginBottom: 0 }}>
            None recorded. Many venues close for a fortnight in low season, which matters more to a
            retreat host than any single public holiday.
          </div>
        )}

        {closureList.map((c) => (
          <div className="row-card" key={c.id} style={{ marginBottom: 'var(--s3)' }}>
            <header>
              <div className="rt" style={{ fontSize: 17 }}>
                {c.reason || c.closure_type}
              </div>
              <button className="link-btn" disabled={pending}
                onClick={() => act(async () => {
                  const res = await removeClosure(c.id, venueId);
                  if (res.ok) setClosureList(closureList.filter((x) => x.id !== c.id));
                  return res;
                })}>Remove</button>
            </header>
            <div className="grid">
              <div className="f">
                <label>From</label>
                <input type="date" data-bwignore style={sel} defaultValue={c.date_from ?? ''}
                  onBlur={(e) => act(() => saveClosure(c.id, venueId, 'date_from', e.target.value))} />
              </div>
              <div className="f">
                <label>To</label>
                <input type="date" data-bwignore style={sel} defaultValue={c.date_to ?? ''}
                  onBlur={(e) => act(() => saveClosure(c.id, venueId, 'date_to', e.target.value))} />
              </div>
              <div className="f">
                <label>Type</label>
                <select defaultValue={c.closure_type} style={sel}
                  onChange={(e) => act(() => saveClosure(c.id, venueId, 'closure_type', e.target.value))}>
                  {CLOSURE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="f">
                <label>Reason</label>
                <input data-bwignore style={sel} defaultValue={c.reason ?? ''}
                  onBlur={(e) => act(() => saveClosure(c.id, venueId, 'reason', e.target.value || null))} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--s3)' }}>
              <button type="button" disabled={pending}
                className={`pill ${c.is_recurring_annually ? 'gold' : ''}`}
                style={{ cursor: 'pointer',
                         background: c.is_recurring_annually ? undefined : 'var(--warm-white)' }}
                onClick={() => act(async () => {
                  const next = !c.is_recurring_annually;
                  setClosureList(closureList.map((x) =>
                    x.id === c.id ? { ...x, is_recurring_annually: next } : x));
                  return saveClosure(c.id, venueId, 'is_recurring_annually', next);
                })}>
                {c.is_recurring_annually ? 'Every year' : 'This year only'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div></div>
  );
}
