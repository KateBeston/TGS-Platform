/* Location block for the detail pages.
 *
 * The written address is the venue owner's own — it is the source of truth and
 * is never derived from the coordinates. The map is a visual guide only: it
 * centres on the confirmed latitude/longitude (more precise than geocoding an
 * address), with a keyless Google embed that needs no API key. When the
 * coordinates are only approximate, we say so, so the text address always wins.
 */
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
      {/* One line above the map, not a stacked block. An address is a single
          fact; setting it as four lines of large serif gave it the weight of a
          heading it has not earned. */}
      {lines.length > 0 && (
        <address className="vmap-address">
          {lines.map((l, i) => (
            <span key={i}>
              {l}
              {i < lines.length - 1 && <i className="vmap-sep" aria-hidden="true" />}
            </span>
          ))}
        </address>
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
