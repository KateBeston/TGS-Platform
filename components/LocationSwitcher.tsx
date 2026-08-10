'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Sibling = {
  id: number; venue_name: string;
  cities?: { name: string } | null;
  countries?: { name: string } | null;
};

/* ═══════════════════════════════════════════════════════════════════════
   THE OTHER LOCATIONS

   Somebody comparing Melbourne with Tokyo should not have to go out
   through a list to do it. Nine AIRE bathhouses differ in what they
   offer, and the comparison is the work.

   Shown only where a venue belongs to a brand with more than one
   location — otherwise it is a dropdown with one item in it.
   ═══════════════════════════════════════════════════════════════════════ */

export default function LocationSwitcher({
  venueId, brand, locations,
}: { venueId: number; brand: { id: number; name: string }; locations: Sibling[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  if (locations.length < 2) return null;

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button className="btn quiet" onClick={() => setOpen(!open)}>
        {brand.name} · {locations.length} locations
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 60,
          background: 'var(--warm-white)', border: '1px solid var(--border)',
          borderTop: '2px solid var(--gold)', marginTop: 4,
          minWidth: 260, maxHeight: 340, overflowY: 'auto',
          boxShadow: '0 6px 24px rgba(49,49,49,.10)',
        }}>
          <a href={`/venues/brands/${brand.id}`}
             style={{ display: 'block', padding: '10px 12px', fontSize: 12,
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--ink-gold)', textDecoration: 'none' }}>
            The brand itself
          </a>

          {locations.map((l) => (
            <button key={l.id} type="button"
              onClick={() => { setOpen(false); router.push(`/venues/${l.id}/details`); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 0,
                padding: '9px 12px', fontSize: 13.5, cursor: 'pointer',
                background: l.id === venueId ? 'var(--warm-cream)' : 'transparent',
                fontWeight: l.id === venueId ? 500 : 400,
              }}>
              {l.venue_name}
              {(l.cities?.name || l.countries?.name) && (
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {[l.cities?.name, l.countries?.name].filter(Boolean).join(', ')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
