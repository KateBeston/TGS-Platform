'use client';

import { useEffect, useState } from 'react';

/* A space, in full.
 *
 * Built on the same bones as RoomDetails — escape closes it, the page behind
 * stops scrolling, the trigger is a quiet link rather than a button — so
 * somebody who has opened a room recognises this immediately.
 *
 * What differs is what a space is judged on. A room is judged on beds and
 * bathrooms; a space is judged on whether the practice you have in mind can
 * happen in it. So the floor, the equipment, the capacity and whether somebody
 * in a wheelchair can reach it matter more here than anything decorative.
 */

type Space = {
  id: number;
  name: string;
  space_type?: string | null;
  description?: string | null;
  area?: string | number | null;
  area_unit?: string | null;
  capacity?: number | null;
  capacity_unit?: string | null;
  theatre_capacity?: number | null;
  boardroom_capacity?: number | null;
  classroom_capacity?: number | null;
  is_outdoor?: boolean | null;
  is_covered?: boolean | null;
  flooring?: string | null;
  climate_control?: string | null;
  lighting?: string | null;
  acoustics?: string | null;
  outlook?: string | null;
  setting?: string | null;
  view_type?: string | null;
  equipment_provided?: string[] | null;
  suitable_for?: string[] | null;
  step_free_access?: boolean | null;
  accessible_bathroom_nearby?: boolean | null;
  access_notes?: string | null;
  wet_weather_alternative?: string | null;
  hire_price?: number | null;
  price_basis?: string | null;
  currency?: string | null;
  is_included?: boolean | null;
  minimum_hours?: number | null;
  image_url?: string | null;
};

const money = (v: number, c: string | null) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: c || 'AUD', maximumFractionDigits: 0 }).format(v);

export function SpaceDetails({ space: s }: { space: Space }) {
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
    s.space_type,
    s.area ? `${s.area} ${s.area_unit ?? 'sqm'}` : null,
    s.capacity ? `holds ${s.capacity}${s.capacity_unit ? ` ${s.capacity_unit}` : ''}` : null,
    s.is_outdoor ? (s.is_covered ? 'Outdoor, covered' : 'Outdoor') : null,
  ].filter(Boolean).join(' · ');

  /* The three seated arrangements, only where a venue has given them. Most
     have not, and an empty row of dashes says less than no row at all. */
  const layouts = [
    s.theatre_capacity ? ['Theatre', s.theatre_capacity] : null,
    s.boardroom_capacity ? ['Boardroom', s.boardroom_capacity] : null,
    s.classroom_capacity ? ['Classroom', s.classroom_capacity] : null,
  ].filter(Boolean) as [string, number][];

  /* What the room is made of. These are the answers to "can I do my practice
     here" — a sprung floor matters to a dancer, acoustics to a sound
     practitioner, and neither is guessable from a photograph. */
  const fabric = [
    s.flooring ? ['Floor', s.flooring] : null,
    s.acoustics ? ['Acoustics', s.acoustics] : null,
    s.lighting ? ['Lighting', s.lighting] : null,
    s.climate_control ? ['Climate', s.climate_control] : null,
    s.outlook ? ['Outlook', s.outlook] : null,
    s.view_type ? ['View', s.view_type] : null,
  ].filter(Boolean) as [string, string][];

  const price = s.is_included
    ? 'Included in your hire'
    : s.hire_price != null
      ? `${money(Number(s.hire_price), s.currency ?? null)} ${(s.price_basis ?? 'per day').toLowerCase()}`
      : null;

  return (
    <>
      <button type="button" className="rm-open" onClick={() => setOpen(true)}>
        Full details
      </button>

      {mounted && open && (
        <div className="rm" role="dialog" aria-modal="true" aria-label={s.name}
          onClick={() => setOpen(false)}>
          <div className="rm-body" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rm-close" onClick={() => setOpen(false)} aria-label="Close">
              &times;
            </button>

            {s.image_url && (
              <div className="rm-img" style={{ backgroundImage: `url(${s.image_url})` }} />
            )}

            <div className="rm-hd">
              <p className="rm-eyebrow">Space</p>
              <h3>{s.name}</h3>
              {meta && <p className="rm-meta">{meta}</p>}
            </div>

            {s.description && <p className="rm-desc">{s.description}</p>}

            {price && (
              <p className="rm-price">{price}
                {s.minimum_hours ? ` · minimum ${s.minimum_hours} hours` : ''}
              </p>
            )}

            {!!(s.suitable_for ?? []).length && (
              <div className="rm-sec">
                <h4>Suited to</h4>
                <div className="rm-amen">
                  {(s.suitable_for ?? []).map((x) => <span key={x}>{x}</span>)}
                </div>
              </div>
            )}

            {!!layouts.length && (
              <div className="rm-sec">
                <h4>Seated capacity</h4>
                <dl className="rm-dl">
                  {layouts.map(([k, val]) => (
                    <div key={k}><dt>{k}</dt><dd>{val}</dd></div>
                  ))}
                </dl>
              </div>
            )}

            {!!fabric.length && (
              <div className="rm-sec">
                <h4>The room itself</h4>
                <dl className="rm-dl">
                  {fabric.map(([k, val]) => (
                    <div key={k}><dt>{k}</dt><dd>{val}</dd></div>
                  ))}
                </dl>
              </div>
            )}

            {!!(s.equipment_provided ?? []).length && (
              <div className="rm-sec">
                <h4>Provided</h4>
                <div className="rm-amen">
                  {(s.equipment_provided ?? []).map((x) => <span key={x}>{x}</span>)}
                </div>
              </div>
            )}

            {/* Access is stated plainly rather than left to be asked about. A
                host planning for somebody with limited mobility should not
                have to email to find out. */}
            {(s.step_free_access != null || s.accessible_bathroom_nearby != null || s.access_notes) && (
              <div className="rm-sec">
                <h4>Getting in</h4>
                <dl className="rm-dl">
                  {s.step_free_access != null && (
                    <div><dt>Step-free access</dt><dd>{s.step_free_access ? 'Yes' : 'No'}</dd></div>
                  )}
                  {s.accessible_bathroom_nearby != null && (
                    <div><dt>Accessible bathroom nearby</dt><dd>{s.accessible_bathroom_nearby ? 'Yes' : 'No'}</dd></div>
                  )}
                </dl>
                {s.access_notes && <p className="rm-note">{s.access_notes}</p>}
              </div>
            )}

            {s.wet_weather_alternative && (
              <div className="rm-sec">
                <h4>If the weather turns</h4>
                <p className="rm-note">{s.wet_weather_alternative}</p>
              </div>
            )}

            <div className="rm-foot">
              <button type="button" className="rm-cls" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
