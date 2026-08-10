/* ═══════════════════════════════════════════════════════════════════════
   MAPS

   Every link generated from the address or the coordinates, never stored.
   A stored URL and a corrected address drift apart silently, and nobody
   notices until a guest is sent somewhere else.

   The embedded map is OpenStreetMap: no key, no cost, no tracking, and
   nothing in anyone's terms about displaying it. Google and Bing are
   offered as links out, which is what a person clicking a map actually
   wants — their own app, with their own saved places and their own
   traffic.
   ═══════════════════════════════════════════════════════════════════════ */

export type MapPlace = {
  name?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  street_address?: string | null;
  postcode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  google_place_id?: string | null;
  entrance_latitude?: number | string | null;
  entrance_longitude?: number | string | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function coordsOf(p: MapPlace): { lat: number; lng: number } | null {
  const lat = num(p.latitude);
  const lng = num(p.longitude);
  if (lat === null || lng === null) return null;
  // 0,0 is in the Atlantic and is what an empty geocode returns.
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Where to arrive, which is not always where the address lands. A rural
 *  property may sit a kilometre from its gate. */
export function arrivalCoords(p: MapPlace) {
  const entrance = coordsOf({
    latitude: p.entrance_latitude, longitude: p.entrance_longitude,
  });
  return entrance ?? coordsOf(p);
}

export function addressLine(p: MapPlace): string | null {
  const parts = [p.street_address, p.city, p.state, p.postcode, p.country]
    .map((s) => (s ?? '').toString().trim()).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export type MapSource = 'Coordinates' | 'Address' | 'City only' | 'Nothing';

export function mapSource(p: MapPlace): MapSource {
  if (coordsOf(p)) return 'Coordinates';
  if (p.street_address && (p.city || p.country)) return 'Address';
  if (p.city || p.country) return 'City only';
  return 'Nothing';
}

/** How far to zoom. A city with no street address should not open at
 *  house level, showing an arbitrary building as though it were the
 *  venue. */
function zoomFor(source: MapSource): number {
  return source === 'Coordinates' ? 16 : source === 'Address' ? 15 : 11;
}

/* ── the embedded map ────────────────────────────────────────────── */

/** OpenStreetMap, which needs no key and asks nothing of the viewer.
 *
 *  Google's embed either needs an API key or uses an undocumented URL
 *  that has broken before. Bing's requires a key for anything reliable.
 *  For an internal tool neither is worth the dependency, and OSM renders
 *  a rural Australian road better than Google does anyway. */
export function osmEmbedUrl(p: MapPlace): string | null {
  const c = coordsOf(p);
  if (!c) return null;
  const source = mapSource(p);
  // Roughly a kilometre at street level, ten at locality level.
  const span = source === 'Coordinates' ? 0.008 : 0.05;
  const bbox = [
    (c.lng - span).toFixed(5), (c.lat - span * 0.6).toFixed(5),
    (c.lng + span).toFixed(5), (c.lat + span * 0.6).toFixed(5),
  ].join(',');
  return `https://www.openstreetmap.org/export/embed.html`
    + `?bbox=${bbox}&layer=mapnik&marker=${c.lat},${c.lng}`;
}

/* ── links out ───────────────────────────────────────────────────── */

export type MapLink = { label: string; url: string; note?: string };

export function mapLinks(p: MapPlace): MapLink[] {
  const c = coordsOf(p);
  const address = addressLine(p);
  const query = c ? `${c.lat},${c.lng}` : address;
  if (!query) return [];

  const q = encodeURIComponent(query);
  const zoom = zoomFor(mapSource(p));
  const links: MapLink[] = [];

  // A place ID resolves to the venue's own listing rather than a pin at a
  // coordinate, which is what somebody wants when they click through.
  links.push({
    label: 'Google Maps',
    url: p.google_place_id
      ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.google_place_id)}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`,
  });

  links.push({
    label: 'Bing Maps',
    url: c
      ? `https://www.bing.com/maps?cp=${c.lat}~${c.lng}&lvl=${zoom}&sp=point.${c.lat}_${c.lng}_${encodeURIComponent(p.name ?? 'Venue')}`
      : `https://www.bing.com/maps?q=${q}`,
  });

  links.push({
    label: 'Apple Maps',
    url: c ? `https://maps.apple.com/?ll=${c.lat},${c.lng}&q=${encodeURIComponent(p.name ?? 'Venue')}`
           : `https://maps.apple.com/?address=${q}`,
    note: 'Opens in Maps on an Apple device',
  });

  links.push({
    label: 'OpenStreetMap',
    url: c ? `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=${zoom}/${c.lat}/${c.lng}`
           : `https://www.openstreetmap.org/search?query=${q}`,
  });

  return links;
}

/** Directions to the arrival point rather than the address, where the two
 *  differ. */
export function directionsUrl(p: MapPlace): string | null {
  const c = arrivalCoords(p);
  const address = addressLine(p);
  const destination = c ? `${c.lat},${c.lng}` : address;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** For a static image where an embed is unwanted — a printed document,
 *  or an email. No key, and it stays legible in greyscale. */
export function staticMapUrl(p: MapPlace, width = 600, height = 320): string | null {
  const c = coordsOf(p);
  if (!c) return null;
  return `https://staticmap.openstreetmap.de/staticmap.php`
    + `?center=${c.lat},${c.lng}&zoom=${zoomFor(mapSource(p))}`
    + `&size=${width}x${height}&markers=${c.lat},${c.lng},lightblue`;
}
