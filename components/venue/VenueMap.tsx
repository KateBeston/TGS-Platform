/* Location block for the detail pages.
 *
 * The written address is the venue owner's own — it is the source of truth and
 * is never derived from the coordinates. The map is a visual guide only: it
 * centres on the confirmed latitude/longitude (more precise than geocoding an
 * address), with a keyless Google embed that needs no API key. When the
 * coordinates are only approximate, we say so, so the text address always wins.
 */
/* The address, as one line. Exported so the location section can pass it as
   its subtitle: it belongs under "Address and map" as that heading's
   subheading, not as the first thing in the body sixty pixels below it. */
export function venueAddressLine(v: Record<string, any>): string {
  return [
    v.street_address,
    [v.locality, v.city].filter(Boolean).join(', '),
    [v.state, v.postcode].filter(Boolean).join(' ').trim(),
    v.country,
  ].map((x) => (x ?? '').toString().trim()).filter(Boolean).join('  \u00b7  ');
}

export default function VenueMap({ v }: { v: Record<string, any> }) {
  const lat = v.latitude != null ? Number(v.latitude) : null;
  const lng = v.longitude != null ? Number(v.longitude) : null;
  const hasCoords = lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng);

  // Owner-provided address, built only from stored address fields.
  const lines = [
    v.street_address,
    [v.locality, v.city].filter(Boolean).join(', '),
    [v.state, v.postcode].filter(Boolean).join(' ').trim(),
    v.country,
  ]
    .map((s: any) => (s ?? '').toString().trim())
    .filter((s: string) => s.length > 0);

  if (!lines.length && !hasCoords) return null;

  const approx = String(v.coordinates_precision ?? '').toLowerCase().includes('approx');
  const zoom = approx ? 12 : 15;
  const embed = hasCoords
    ? `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=en-AU&output=embed`
    : null;
  const directions =
    (v.maps_url && String(v.maps_url).trim()) ||
    (hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` +
        (v.google_place_id ? `&query_place_id=${v.google_place_id}` : '')
      : null);

  return (
    <div className="vmap">
      {/* One centred line under the section title, reading as its subheading.
          Serif and larger than body text, but lighter, so it sits with the
          title rather than competing with it. */}

      {/* Coordinates, for anyone driving in or briefing a transfer. Six decimal
          places is roughly a tenth of a metre, which is more than enough and
          stops a long float reading as noise. */}
      {hasCoords && (
        <p className="vmap-coords">
          <span>{lat!.toFixed(6)}, {lng!.toFixed(6)}</span>
        </p>
      )}

      {embed && (
        <div className="vmap-frame">
          <iframe
            src={embed}
            title={`Map showing ${v.venue_name ?? 'the venue'}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}

      <div className="vmap-foot">
        {directions && (
          <a className="vmap-link" href={directions} target="_blank" rel="noopener noreferrer">
            Open in Google Maps
          </a>
        )}
        {approx && (
          <p className="vmap-note">
            The pin shows the approximate area. The address above is the location as provided by the venue.
          </p>
        )}
      </div>
    </div>
  );
}
