'use client';

import { useEffect, useMemo, useState } from 'react';
import { slotsFor, type Slot } from '@/app/actions/availability';
import { cartToken } from '@/lib/cartToken';

/* ═══════════════════════════════════════════════════════════════════════
   CHOOSING A REAL TIME

   Dates across the top, times underneath, and every time labelled with
   the venue's own clock. Where the guest is in a different zone, their
   time sits beneath it in smaller type — because a 9am session in
   Australia is the evening before in Canada, and the day is what people
   get wrong, not the hour.

   A venue with no hours recorded, no timezone, or nothing free in the next
   two months returns nothing. The picker says so and hands back to the
   old preference control rather than showing an empty grid: a guest who
   cannot see a time must still be able to ask for one.
   ═══════════════════════════════════════════════════════════════════════ */

export type Chosen = {
  date: string;
  startsLocal: string;
  endsLocal: string;
  startsUtc: string;
  tz: string;
  slotId: number | null;
};

const dayLabel = (iso: string) => {
  try {
    /* Read as a plain calendar day. new Date('2026-10-17') is midnight UTC,
       which in Brisbane is already the 17th but in Toronto is the 16th —
       so the parts are assembled by hand rather than trusting the browser's
       zone to agree with the venue's date. */
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  } catch { return iso; }
};

const zoneName = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;

export default function SlotPicker({
  venueId, serviceId, people, value, onChange, onUnavailable, format,
}: {
  venueId: number;
  serviceId: number;
  people: number;
  value: Chosen | null;
  onChange: (c: Chosen | null) => void;
  /** Called once when there is nothing to show, so the parent can fall
   *  back to asking for a preferred time of day. */
  onUnavailable: () => void;
  /** How the service is taken. A class is a session on a timetable with
   *  places in it; an appointment is an hour of the venue's day. Both
   *  arrive here as times, but a guest reads them differently, so the
   *  words change even though the grid does not. */
  format?: string | null;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string>('');
  const [guestTz, setGuestTz] = useState<string | null>(null);

  /* Read in an effect, not at render: the server has no idea where the
     guest is, and guessing would make the first paint disagree with the
     second. */
  useEffect(() => {
    try { setGuestTz(Intl.DateTimeFormat().resolvedOptions().timeZone || null); }
    catch { setGuestTz(null); }
  }, []);

  useEffect(() => {
    let live = true;
    setSlots(null);
    /* The cart's token goes with the question. free_slots subtracts every
       live hold except this cart's, so without it the guest would lose
       sight of the very time they are holding. */
    slotsFor(venueId, serviceId, people, undefined, cartToken())
      .then((r) => {
        if (!live) return;
        setSlots(r.slots);
        if (!r.slots.length) onUnavailable();
      })
      .catch(() => { if (live) { setSlots([]); onUnavailable(); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, serviceId, people]);

  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    return m;
  }, [slots]);

  const days = useMemo(() => [...byDay.keys()].sort(), [byDay]);

  /* Open on the first day that has anything, or on the day already chosen. */
  useEffect(() => {
    if (!days.length) return;
    setDay((d) => (d && byDay.has(d) ? d : (value?.date && byDay.has(value.date) ? value.date : days[0])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(',')]);

  /* A chosen time that is no longer offered — the party grew, or somebody
     else took it — is dropped rather than left looking selected. */
  useEffect(() => {
    if (!value || !slots) return;
    const still = slots.some((s) => s.date === value.date && s.startsLocal === value.startsLocal);
    if (!still) onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const scheduled = format === 'Scheduled session';
  const unit = scheduled ? 'session' : 'time';

  if (slots === null) {
    return (
      <div className="sp">
        <span className="xb-label">Choose a {unit}</span>
        <p className="sp-loading">
          {scheduled
            ? 'Reading the venue’s timetable…'
            : 'Reading the venue’s availability…'}
        </p>
      </div>
    );
  }

  if (!slots.length) return null;

  const tz = slots[0].tz;
  const showGuestTime = !!guestTz && guestTz !== tz;
  const times = byDay.get(day) ?? [];

  const guestTime = (utc: string) => {
    if (!guestTz) return null;
    try {
      return new Date(utc).toLocaleString('en-AU', {
        timeZone: guestTz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch { return null; }
  };

  return (
    <div className="sp">
      <span className="xb-label">Choose a date</span>
      <div className="sp-days" role="tablist" aria-label="Available dates">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === day}
            className={`sp-day${d === day ? ' sp-day-on' : ''}`}
            onClick={() => setDay(d)}
          >
            <span className="sp-day-label">{dayLabel(d)}</span>
            <span className="sp-day-count">
              {(byDay.get(d) ?? []).length} {unit}
              {(byDay.get(d) ?? []).length === 1 ? '' : 's'}
            </span>
          </button>
        ))}
      </div>

      <span className="xb-label sp-times-label">
        {scheduled ? 'Sessions at the venue' : 'Times at the venue'} · {zoneName(tz)}
      </span>
      <div className="sp-times">
        {times.map((s) => {
          const on = value?.date === s.date && value?.startsLocal === s.startsLocal;
          const mine = showGuestTime ? guestTime(s.startsUtc) : null;
          return (
            <button
              key={`${s.date}-${s.startsLocal}`}
              type="button"
              aria-pressed={on}
              className={`sp-time${on ? ' sp-time-on' : ''}`}
              onClick={() => onChange(on ? null : {
                date: s.date, startsLocal: s.startsLocal, endsLocal: s.endsLocal,
                startsUtc: s.startsUtc, tz: s.tz, slotId: s.slotId,
              })}
            >
              <span className="sp-time-at">
                {s.startsLocal}
                {/* A class is a block of the guest's evening, not a start
                    time, so it is shown as one. */}
                {scheduled && s.endsLocal ? `–${s.endsLocal}` : ''}
              </span>
              {mine && <span className="sp-time-mine">{mine} your time</span>}
              {/* Places are the point of a class — a guest deciding between
                  Tuesday and Thursday wants to know which is filling up,
                  not only which is nearly gone. For an appointment the
                  number is noise until it is nearly gone. */}
              {s.slotId != null && (scheduled || s.placesLeft <= 3) && (
                <span className="sp-time-left">
                  {s.placesLeft} place{s.placesLeft === 1 ? '' : 's'} left
                </span>
              )}
            </button>
          );
        })}
      </div>

      {scheduled && (
        <p className="sp-note">
          These run to the venue&rsquo;s timetable and are shared with other
          guests. The places shown are what is left in that session.
        </p>
      )}

      {showGuestTime && (
        <p className="sp-note">
          Shown in the venue&rsquo;s time first, with yours beneath. The venue
          confirms your time before anything is charged.
        </p>
      )}
    </div>
  );
}
