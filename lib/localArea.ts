/* Local-area harvester — reads what is genuinely around a venue from its
 * coordinates, so distances and excursions are derived, not guessed.
 *
 * Uses Places API (NEW) — the legacy Nearby Search can no longer be
 * enabled on projects that don't already have it, so this targets the
 * only version you can switch on today. Enable "Places API (New)" in
 * Google Cloud; travel times additionally use the Distance Matrix API
 * (optional — without it, places still harvest, just without a time).
 *
 * Same GOOGLE_MAPS_API_KEY the geocoder already uses. Everything fails
 * soft, because this feeds a review screen, not a live page. */

const KEY = process.env.GOOGLE_MAPS_API_KEY;
const NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';
const TEXT = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = 'places.id,places.displayName,places.location';

type Place = { name: string; place_id: string; lat: number | null; lng: number | null };

export type DistanceProposal = {
  label: string; category: string; travel_value: number | null; travel_unit: string;
  latitude: number | null; longitude: number | null; google_place_id: string; travel_mode: string;
};
export type ExcursionProposal = {
  name: string; description: string; duration_label: string; google_place_id: string;
};

function toPlace(p: any): Place {
  return { name: p?.displayName?.text ?? '', place_id: p?.id ?? '',
           lat: p?.location?.latitude ?? null, lng: p?.location?.longitude ?? null };
}

/** Places API (New) Nearby Search — closest place of a type. */
async function nearestByType(lat: number, lng: number, type: string): Promise<Place | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(NEARBY, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({
        includedTypes: [type], maxResultCount: 1, rankPreference: 'DISTANCE',
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } },
      }),
    });
    const json = await res.json();
    return json.places?.[0] ? toPlace(json.places[0]) : null;
  } catch { return null; }
}

/** Places API (New) Text Search — for keyword anchors (beach, town centre). */
async function nearestByText(lat: number, lng: number, query: string): Promise<Place | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(TEXT, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({
        textQuery: query, maxResultCount: 1,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } },
      }),
    });
    const json = await res.json();
    return json.places?.[0] ? toPlace(json.places[0]) : null;
  } catch { return null; }
}

/** Places API (New) Nearby Search — several notable places of a type. */
async function severalByType(lat: number, lng: number, type: string, limit: number): Promise<Place[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(NEARBY, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({
        includedTypes: [type], maxResultCount: limit, rankPreference: 'POPULARITY',
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 30000 } },
      }),
    });
    const json = await res.json();
    return (json.places ?? []).map(toPlace);
  } catch { return []; }
}

/** Distance Matrix — driving minutes. Its own API; fails soft to null. */
async function driveMinutes(oLat: number, oLng: number, d: Place): Promise<number | null> {
  if (!KEY || d.lat == null || d.lng == null) return null;
  const q = new URLSearchParams({
    origins: `${oLat},${oLng}`, destinations: `${d.lat},${d.lng}`, mode: 'driving', key: KEY,
  });
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${q}`, { cache: 'no-store' });
    const json = await res.json();
    const el = json.rows?.[0]?.elements?.[0];
    if (!el || el.status !== 'OK') return null;
    return Math.max(1, Math.round((el.duration?.value ?? 0) / 60));
  } catch { return null; }
}

export async function proposeFromCoords(lat: number, lng: number): Promise<{
  distances: DistanceProposal[]; excursions: ExcursionProposal[]; error?: string;
}> {
  if (!KEY) {
    return { distances: [], excursions: [], error: 'GOOGLE_MAPS_API_KEY is not set in the portal environment.' };
  }

  const anchors: { label: string; category: string; type?: string; text?: string }[] = [
    { label: 'Nearest airport', category: 'airport', type: 'airport' },
    { label: 'Nearest train station', category: 'transport', type: 'train_station' },
    { label: 'Nearest town centre', category: 'town', text: 'town centre' },
    { label: 'Nearest beach', category: 'nature', text: 'beach' },
  ];

  const distances: DistanceProposal[] = [];
  for (const a of anchors) {
    const place = a.type ? await nearestByType(lat, lng, a.type) : await nearestByText(lat, lng, a.text!);
    if (!place || !place.place_id) continue;
    const mins = await driveMinutes(lat, lng, place);
    distances.push({
      label: `${a.label} (${place.name})`, category: a.category,
      travel_value: mins, travel_unit: mins != null ? 'min' : '',
      latitude: place.lat, longitude: place.lng, google_place_id: place.place_id, travel_mode: 'driving',
    });
  }

  const seen = new Set<string>();
  const spots = [
    ...(await severalByType(lat, lng, 'tourist_attraction', 8)),
    ...(await severalByType(lat, lng, 'park', 4)),
  ];
  const excursions: ExcursionProposal[] = [];
  for (const s of spots) {
    if (!s.place_id || seen.has(s.place_id)) continue;
    seen.add(s.place_id);
    const mins = await driveMinutes(lat, lng, s);
    excursions.push({
      name: s.name, description: '',
      duration_label: mins != null ? `${mins} min drive` : '', google_place_id: s.place_id,
    });
    if (excursions.length >= 6) break;
  }

  return { distances, excursions };
}
