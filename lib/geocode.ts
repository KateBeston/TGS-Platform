/* ═══════════════════════════════════════════════════════════════════════
   GEOCODE VERIFICATION

   Two independent providers, compared. Agreement between sources with
   different data lineage is evidence; a single source is only a claim.

   Google  — best coverage for hospitality, and location_type reports
             honestly whether it found a rooftop or interpolated from a
             street range.
   OSM     — Nominatim. Free, no key, entirely separate data lineage,
             which is precisely what makes agreement meaningful.

   Bing is deliberately absent: Microsoft retired it for free accounts in
   June 2025 and is directing users to Azure Maps.
   ═══════════════════════════════════════════════════════════════════════ */

export type Point = {
  lat: number;
  lng: number;
  precision?: string;
  country?: string;
  /** Returned by both providers and previously discarded. state_id is
   *  null on every venue, and this is where it comes from. */
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  formatted?: string | null;
  placeId?: string | null;
};

export type Verdict =
  | 'Agreed' | 'Close' | 'Disagreed' | 'SingleSource' | 'NoResult' | 'CountryMismatch';

export type GeocodeResult = {
  google: Point | null;
  osm: Point | null;
  distanceMetres: number | null;
  verdict: Verdict;
  chosen: Point | null;
  chosenSource: 'Google' | 'OSM' | null;
  note?: string;
};

/** Haversine. Good to a metre or two at these distances, which is far
 *  finer than the thresholds we care about. */
export function distanceMetres(a: Point, b: Point): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

async function geocodeGoogle(address: string): Promise<Point | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json`
    + `?address=${encodeURIComponent(address)}&key=${key}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();
    if (json.status !== 'OK' || !json.results?.length) return null;

    const r = json.results[0];
    const part = (type: string, short = false) => {
      const c = (r.address_components ?? []).find((x: any) => x.types?.includes(type));
      return short ? c?.short_name : c?.long_name;
    };

    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      precision: r.geometry.location_type,   // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
      country: part('country', true),
      // locality is the town. A rural property often has none, and
      // postal_town or the second-level administrative area is the
      // nearest thing to one.
      city: part('locality')
        ?? part('postal_town')
        ?? part('administrative_area_level_2'),
      state: part('administrative_area_level_1'),
      postcode: part('postal_code'),
      formatted: r.formatted_address,
      placeId: r.place_id,
    };
  } catch {
    return null;
  }
}

async function geocodeOSM(address: string): Promise<Point | null> {
  const url = `https://nominatim.openstreetmap.org/search`
    + `?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;

  try {
    // Nominatim requires an identifying User-Agent and permits roughly one
    // request per second. The caller paces the batch.
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TheGlobalSanctum-Portal/1.0 (hello@theglobalsanctum.com)' },
      cache: 'no-store',
    });
    const json = await res.json();
    if (!Array.isArray(json) || !json.length) return null;

    const r = json[0];
    const a = r.address ?? {};
    return {
      lat: Number(r.lat),
      lng: Number(r.lon),
      precision: r.type,
      country: a.country_code?.toUpperCase(),
      // Nominatim names the settlement differently by size and country —
      // a hamlet is not a city, and both are what somebody means when
      // they say where a venue is.
      city: a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.suburb,
      state: a.state ?? a.province ?? a.region ?? a.county,
      postcode: a.postcode,
      formatted: r.display_name,
      placeId: null,
    };
  } catch {
    return null;
  }
}

/** Thresholds are deliberately generous at the top end: two providers
 *  pinning opposite corners of a large rural property can legitimately
 *  differ by a few hundred metres. Beyond 500m they are describing
 *  different places and a person should look. */
export function judge(
  google: Point | null, osm: Point | null, expectedCountry?: string | null
): GeocodeResult {
  if (!google && !osm) {
    return { google, osm, distanceMetres: null, verdict: 'NoResult',
             chosen: null, chosenSource: null };
  }

  // A wrong country is the classic failure — a same-named town on another
  // continent. Catch it before anything else.
  if (expectedCountry) {
    const wrong = [google, osm].filter(
      (p) => p?.country && p.country !== expectedCountry
    );
    if (wrong.length && wrong.length === [google, osm].filter(Boolean).length) {
      return { google, osm, distanceMetres: null, verdict: 'CountryMismatch',
               chosen: null, chosenSource: null,
               note: `Expected ${expectedCountry}, geocoders returned `
                 + `${[google?.country, osm?.country].filter(Boolean).join(' and ')}` };
    }
  }

  if (!google || !osm) {
    const only = (google ?? osm)!;
    return { google, osm, distanceMetres: null, verdict: 'SingleSource',
             chosen: only, chosenSource: google ? 'Google' : 'OSM',
             note: 'Only one provider returned a result. Lower confidence.' };
  }

  const d = distanceMetres(google, osm);

  // Google wins ties: better hospitality coverage, and ROOFTOP is the most
  // precise signal either provider gives.
  const chosen = google.precision === 'ROOFTOP' ? google
    : osm.precision === 'building' ? osm
    : google;
  const chosenSource: 'Google' | 'OSM' = chosen === osm ? 'OSM' : 'Google';

  if (d <= 50)  return { google, osm, distanceMetres: d, verdict: 'Agreed', chosen, chosenSource };
  if (d <= 500) return { google, osm, distanceMetres: d, verdict: 'Close', chosen, chosenSource,
                         note: 'Same block or large property. Worth a glance.' };

  return { google, osm, distanceMetres: d, verdict: 'Disagreed', chosen: null, chosenSource: null,
           note: `Providers disagree by ${(d / 1000).toFixed(1)} km. Choose one.` };
}

export async function verifyAddress(
  address: string, expectedCountry?: string | null
): Promise<GeocodeResult> {
  const [google, osm] = await Promise.all([
    geocodeGoogle(address),
    geocodeOSM(address),
  ]);
  return judge(google, osm, expectedCountry);
}
