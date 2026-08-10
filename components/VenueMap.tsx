'use client';

import {
  addressLine, coordsOf, directionsUrl, mapLinks, mapSource, osmEmbedUrl,
  type MapPlace,
} from '@/lib/maps';

/* ═══════════════════════════════════════════════════════════════════════
   VENUE MAP

   Four states, because four exist in the data: coordinates, an address,
   a city only, and nothing at all. Most venues are in the last group.

   The map is only drawn where there are coordinates. Showing a city-level
   pin at street zoom implies a precision that is not there, and a pin on
   the wrong building is worse than no pin.
   ═══════════════════════════════════════════════════════════════════════ */

export default function VenueMap({
  place, height = 320, showLinks = true,
}: { place: MapPlace; height?: number; showLinks?: boolean }) {
  const source = mapSource(place);
  const embed = osmEmbedUrl(place);
  const links = mapLinks(place);
  const directions = directionsUrl(place);
  const coords = coordsOf(place);
  const address = addressLine(place);

  if (source === 'Nothing') {
    return (
      <div className="note" style={{ marginBottom: 0 }}>
        <strong>Nowhere to put a pin.</strong> No coordinates, no street address, and no city — so
        there is nothing to show and nothing to search on. An address is enough; coordinates are
        better.
      </div>
    );
  }

  return (
    <>
      {embed ? (
        <div style={{ border: '1px solid var(--border)', marginBottom: 'var(--s3)' }}>
          <iframe
            title="Map"
            src={embed}
            width="100%"
            height={height}
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <div className="note">
          <strong>
            {source === 'Address'
              ? 'An address but no coordinates.'
              : 'A city, but nothing more precise.'}
          </strong>{' '}
          {source === 'Address'
            ? 'The links below will find it, but no map is drawn here — a pin placed from an address alone can land on the wrong building, and a wrong pin is worse than none.'
            : 'Not precise enough to place. Add a street address, then geocode it.'}
        </div>
      )}

      {coords && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginBottom: 'var(--s3)',
                      fontVariantNumeric: 'tabular-nums' }}>
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {place.entrance_latitude && (
            <span style={{ color: 'var(--ink-gold)' }}> · a separate arrival point is recorded</span>
          )}
        </div>
      )}

      {showLinks && !!links.length && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {links.map((l) => (
            <a key={l.label} className="pill" href={l.url} target="_blank" rel="noopener"
               title={l.note} style={{ textDecoration: 'none', cursor: 'pointer' }}>
              {l.label}
            </a>
          ))}
          {directions && (
            <a className="pill gold" href={directions} target="_blank" rel="noopener"
               style={{ textDecoration: 'none', cursor: 'pointer' }}>
              Directions
            </a>
          )}
        </div>
      )}

      {address && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-quiet)', marginTop: 'var(--s3)' }}>
          {address}
        </div>
      )}

      {place.entrance_latitude ? null : coords ? (
        <div className="help" style={{ marginTop: 'var(--s3)' }}>
          Directions go to these coordinates. Where the entrance is somewhere else — a long
          driveway, a gate on another road — record an arrival point below.
        </div>
      ) : null}
    </>
  );
}
