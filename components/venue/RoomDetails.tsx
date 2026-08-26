'use client';

/* Room details & policies — the modal opened from an accommodation card.
 * Everything is conditional: a room with thin data shows only what it has,
 * so this degrades gracefully for venues that have not filled it in yet. */

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Room = {
  id: number;
  name: string;
  description?: string | null;
  quantity?: number | null;
  sleeps?: number | null;
  bed_configuration?: string | null;
  bathroom_type?: string | null;
  room_size?: string | null;
  room_size_unit?: string | null;
  outlook?: string | null;
  primary_image_url?: string | null;
  room_amenities?: string[] | null;
  max_occupancy?: number | null;
  max_adults?: number | null;
  max_children?: number | null;
  children_permitted?: boolean | null;
  rollaway_beds?: number | null;
  min_nights?: number | null;
  min_nights_note?: string | null;
  advance_notice_hours?: number | null;
};

function occupancyLine(r: Room): string | null {
  if (r.max_adults) {
    const base = `${r.max_adults} adult${r.max_adults === 1 ? '' : 's'}`;
    if (r.max_children && r.max_children > 0) {
      return `${base}, or ${r.max_adults} adult${r.max_adults === 1 ? '' : 's'} + ${r.max_children} child${r.max_children === 1 ? '' : 'ren'}`;
    }
    return base;
  }
  if (r.max_occupancy) return `${r.max_occupancy} guest${r.max_occupancy === 1 ? '' : 's'}`;
  if (r.sleeps) return `${r.sleeps} guest${r.sleeps === 1 ? '' : 's'}`;
  return null;
}

function minStayLine(r: Room): string | null {
  if (r.min_nights_note) return r.min_nights_note;
  if (r.min_nights) return `${r.min_nights} night${r.min_nights === 1 ? '' : 's'}`;
  return null;
}

export function RoomDetails({ room: r }: { room: Room }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  const meta = [
    r.quantity ? `${r.quantity} available` : null,
    r.sleeps ? `Sleeps ${r.sleeps}` : null,
    r.bed_configuration, r.bathroom_type,
    r.room_size ? `${r.room_size} ${r.room_size_unit ?? 'sqm'}` : null,
    r.outlook,
  ].filter(Boolean).join(' · ');

  const occ = occupancyLine(r);
  const minStay = minStayLine(r);
  const hasBedding = r.bed_configuration || (r.rollaway_beds ?? 0) > 0;
  const hasBooking = minStay || r.advance_notice_hours;
  const hasOccBed = occ || hasBedding || r.children_permitted != null;

  return (
    <>
      <button type="button" className="rm-trigger" onClick={() => setOpen(true)}>
        Room details &amp; policies
      </button>

      {open && mounted && createPortal(
        <div className="rm-overlay" role="dialog" aria-modal="true" aria-label={`${r.name} details`} onClick={() => setOpen(false)}>
          <div className="rm" onClick={(e) => e.stopPropagation()}>
            <div className="rm-img">
              {r.primary_image_url && <img src={r.primary_image_url} alt={r.name} />}
              <button type="button" className="rm-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="rm-hd">
              <div className="rm-eyebrow">Room details &amp; policies</div>
              <div className="rm-name">{r.name}</div>
              {meta && <div className="rm-meta">{meta}</div>}
            </div>
            <div className="rm-body">

              <div className="rm-sect">
                <div className="rm-sh">Room details</div>
                <dl className="rm-spec">
                  {r.room_size && <div><dt>Room size</dt><dd>{r.room_size} {r.room_size_unit ?? 'sqm'}</dd></div>}
                  {r.bed_configuration && <div><dt>Bed</dt><dd>{r.bed_configuration}</dd></div>}
                  {r.bathroom_type && <div><dt>Bathroom</dt><dd>{r.bathroom_type}</dd></div>}
                  {r.outlook && <div><dt>Outlook</dt><dd>{r.outlook}</dd></div>}
                  {r.sleeps && <div><dt>Sleeps</dt><dd>{r.sleeps} guest{r.sleeps === 1 ? '' : 's'}</dd></div>}
                </dl>
              </div>

              {!!r.room_amenities?.length && (
                <div className="rm-sect">
                  <div className="rm-sh">In-room amenities</div>
                  <div className="rm-amen">
                    {r.room_amenities.map((a) => (
                      <span key={a}><span className="rm-tick" />{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {hasOccBed && (
                <div className="rm-sect">
                  <div className="rm-sh">Occupancy &amp; bedding</div>
                  <dl className="rm-spec">
                    {occ && <div><dt>Maximum occupancy</dt><dd>{occ}</dd></div>}
                    {r.bed_configuration && <div><dt>Bedding</dt><dd>{r.bed_configuration}</dd></div>}
                    {(r.rollaway_beds ?? 0) > 0 && <div><dt>Rollaway</dt><dd>Available on request</dd></div>}
                    {r.children_permitted != null && <div><dt>Children</dt><dd>{r.children_permitted ? 'Welcome' : 'Not suited to children'}</dd></div>}
                  </dl>
                </div>
              )}

              {hasBooking && (
                <div className="rm-sect">
                  <div className="rm-sh">Booking</div>
                  <dl className="rm-spec">
                    {minStay && <div><dt>Minimum stay</dt><dd>{minStay}</dd></div>}
                    {r.advance_notice_hours ? <div><dt>Advance notice</dt><dd>{r.advance_notice_hours} hours</dd></div> : null}
                    <div><dt>Cancellation</dt><dd>As per venue policy</dd></div>
                  </dl>
                </div>
              )}

            </div>
            <div className="rm-foot">
              <button type="button" className="rm-cls" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
