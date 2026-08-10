/* ═══════════════════════════════════════════════════════════════════════
   VENUE INTAKE

   One URL in, a complete draft venue out.

   Different from the harvest, which enriches records that already exist.
   This builds a new one: several pages read at once, child records
   included, and nothing written until the whole thing has been checked.

   The pages matter more than the model. A home page rarely states
   capacity; an Accommodation page always does. So the links are followed
   before anything is read.
   ═══════════════════════════════════════════════════════════════════════ */

export const INTAKE_MODEL = 'claude-haiku-4-5-20251001';

/** Pages worth following, scored rather than matched.
 *
 *  The first version matched a handful of obvious words and missed most
 *  of a real site. Curraweena links to /the-property, /amenities and
 *  /faqs from its main navigation — the facilities list, the spaces and
 *  the policies — and none of the three matched anything.
 *
 *  Scored so the best pages are read first rather than whichever appeared
 *  earliest in the markup. */
const PAGE_PATTERNS: { test: RegExp; label: string; holds: string; score: number }[] = [
  { test: /\b(accommodation|rooms?|stay|suites?|villas?|lodging|sleep|bedrooms?)\b/i,
    label: 'Accommodation', holds: 'bedrooms, capacity, bed configuration', score: 100 },

  { test: /\b(rates?|pric(e|ing)|tariff|cost|fees?|packages?|inclusions?)\b/i,
    label: 'Rates', holds: 'prices, minimums, deposits', score: 95 },

  { test: /\b(the-)?(propert(y|ies)|grounds|estate|our-(home|space|place)|venue)\b/i,
    label: 'The property', holds: 'spaces, grounds, what is on site', score: 90 },

  { test: /\b(amenit(y|ies)|facilit(y|ies)|inclusions?|what.?s-included|equipment)\b/i,
    label: 'Amenities', holds: 'the facilities list — usually the fullest one', score: 90 },

  { test: /\b(faqs?|frequently-asked|questions|good-to-know|need-to-know)\b/i,
    label: 'FAQs', holds: 'policies, what is included, practical detail', score: 85 },

  { test: /\b(spaces?|studio|shala|barn|hall|room-hire|venue-hire|workshop-space)\b/i,
    label: 'Spaces', holds: 'practice rooms and their capacities', score: 85 },

  { test: /\b(services?|treatments?|spa|therap(y|ies)|massage|menu-of|wellness)\b/i,
    label: 'Services', holds: 'treatments, durations, prices', score: 80 },

  { test: /\b(terms|conditions|polic(y|ies)|cancellation|booking-terms)\b/i,
    label: 'Terms', holds: 'booking terms, cancellation, house rules', score: 80 },

  { test: /\b(plan-your|host(ing)?-your|retreat-lead|for-(hosts?|facilitators?)|group-bookings?)\b/i,
    label: 'For hosts', holds: 'whether hosts may bring their own programme', score: 75 },

  { test: /\b(dining|food|catering|chefs?|meals?|kitchen|eat)\b/i,
    label: 'Dining', holds: 'catering, kitchen, whether meals are included', score: 70 },

  { test: /\b(about|our-story|who-we-are|the-(retreat|experience))\b/i,
    label: 'About', holds: 'history, setting, what the place is', score: 65 },

  { test: /\b(contact|find-us|get-in-touch|location|directions|how-to-get)\b/i,
    label: 'Contact', holds: 'address, phone, email, getting there', score: 65 },

  { test: /\b(experiences?|activit(y|ies)|things-to-do|local|nearby|explore|bushwalks?|markets?)\b/i,
    label: 'Nearby', holds: 'local experiences and what is reachable', score: 55 },

  { test: /\b(workshops?|programs?|programmes?|classes|schedule)\b/i,
    label: 'Programme', holds: 'what runs there and how often', score: 50 },
];

/** Documents worth reading, which the first version excluded by rule.
 *
 *  This was the worst of the misses. A venue's rates and terms are very
 *  often a PDF linked from the navigation — Curraweena's entire pricing
 *  and cancellation position is in one — and skipping every .pdf meant
 *  skipping the most valuable page on the site. */
const DOCUMENT_PATTERNS: { test: RegExp; label: string; score: number }[] = [
  { test: /\b(pric|rate|terms|tariff|cost|fee)/i, label: 'Pricing and terms', score: 98 },
  { test: /\b(guide|information|info|brochure|pack|kit)/i, label: 'Information guide', score: 72 },
  { test: /\b(menu|catering|food)/i, label: 'Menu', score: 60 },
  { test: /\b(floor.?plan|layout|site.?map)/i, label: 'Floor plan', score: 55 },
];

export type DiscoveredPage = {
  url: string; label: string; holds: string; score: number; isDocument: boolean;
};

/** Finds what is worth reading from the links on a page.
 *
 *  Matched on the address and the link text together, because a site may
 *  label a page "Where to stay" at /the-rooms and neither alone finds it.
 *  Squarespace and Wix repeat their navigation several times in the
 *  markup, so results are deduplicated by address. */
export function discoverPages(
  html: string, baseUrl: string, max = 10,
  /** Stay beneath this path.
   *
   *  Set when reading one location of a chain. Without it, reading
   *  1hotels.com/melbourne follows links to /tokyo and /austin, and
   *  Melbourne's record ends up describing Tokyo's spa — wrong in a way
   *  nobody would notice, because every page read was genuinely from the
   *  right website. */
  withinPath?: string,
): DiscoveredPage[] {
  let origin: string;
  try { origin = new URL(baseUrl).origin; } catch { return []; }

  const found = new Map<string, DiscoveredPage>();
  const takenLabels = new Set<string>();

  const candidates: DiscoveredPage[] = [];

  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    const linkText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    let url: URL;
    try { url = new URL(m[1], baseUrl); } catch { continue; }
    if (url.origin !== origin) continue;
    if (withinPath && !url.pathname.startsWith(withinPath)) continue;

    const path = url.pathname;
    const key = origin + path;
    if (found.has(key)) continue;

    // Never useful: media, carts, logins, feeds.
    if (/\.(jpe?g|png|gif|svg|webp|zip|mp4|mov|css|js|xml|ico)$/i.test(path)) continue;
    if (/\/(cart|checkout|login|account|search|feed|rss|sitemap)\b/i.test(path)) continue;

    const haystack = `${decodeURIComponent(path)} ${linkText}`;

    // Documents first — a PDF named "Pricing and Terms" outranks every
    // ordinary page, because it is the thing itself rather than a page
    // describing it.
    if (/\.(pdf|docx?)$/i.test(path)) {
      const doc = DOCUMENT_PATTERNS.find((d) => d.test.test(haystack));
      if (doc) {
        candidates.push({
          url: key, label: doc.label, score: doc.score, isDocument: true,
          holds: 'a document from their own site',
        });
      }
      continue;
    }

    if (path === '/' || path === '') continue;

    const hit = PAGE_PATTERNS.find((p) => p.test.test(haystack));
    if (hit) {
      candidates.push({
        url: key, label: hit.label, holds: hit.holds, score: hit.score, isDocument: false,
      });
    }
  }

  // Best first, one of each kind. Two accommodation pages rarely say
  // different things; an accommodation page and an amenities page always
  // do.
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (found.size >= max) break;
    if (takenLabels.has(c.label)) continue;
    found.set(c.url, c);
    takenLabels.add(c.label);
  }

  return [...found.values()];
}

export function buildIntakePrompt(venueTypes: string[], hireTypes: string[]): string {
  return [
    'You are reading a wellness or retreat venue\'s own website to create a new record.',
    'Several pages from the same site follow, each marked with its heading.',
    '',
    '── THE NAME ──',
    '',
    'Return the venue\'s name exactly as the site writes it.',
    '',
    '• Keep every accent and diacritic. Kāhili, Çırağan, Hôtel, Ōkiwi — the',
    '  macron or cedilla is part of the name, not a typo. Never strip one.',
    '• Keep ampersands, apostrophes and hyphens as written.',
    '• Never take the name from the web address. Domains cannot carry',
    '  accents, so kahili-retreat.com tells you nothing about whether the',
    '  name is Kāhili.',
    '• If the site writes the name in capitals throughout, return it in',
    '  normal case AND say so in flags — that is a styling choice and the',
    '  reader should decide.',
    '• Do not add or remove words. "The" belongs if they use it.',
    '',
    '── RULES ──',
    '',
    '1. Only state what the pages say. Null is a correct answer and a far',
    '   better one than a guess.',
    '2. Do not infer from category. A retreat centre does not necessarily',
    '   welcome outside facilitators; say null unless it says so.',
    '3. Ignore other properties. Some sites list sister venues.',
    '4. Prices as written, with their currency. Never convert.',
    '5. Anything you are unsure of goes in flags, in plain words.',
    '',
    'Venue types — choose one or null:',
    venueTypes.map((t) => `  ${t}`).join('\n'),
    '',
    'Hire types — choose any that apply:',
    hireTypes.map((t) => `  ${t}`).join('\n'),
    '',
    'Return only a JSON object, no preamble and no markdown fence:',
    '',
    '{',
    '  "venue_name": exactly as written, accents intact',
    '  "name_note": null, or e.g. "the site writes it in capitals throughout"',
    '  "venue_type": one from the list, or null',
    '  "business_status": exactly one of "Operating", "Seasonal",',
    '    "Temporarily closed", "Permanently closed", "Pre-opening" —',
    '    and only where the site plainly says so. A site that has simply',
    '    not been updated is not a closed business, and guessing turns',
    '    neglect into a fact.',
    '  "hire_types": array from the list',
    '  "venue_short_description": two plain sentences, Australian spelling',
    '  "setting_description": two or three sentences on what the place is',
    '    like to be in — the land, the outlook, the sound of it. Their',
    '    words where they have written it well.',
    '  "location_tagline": a short line placing it, if they have one',
    '  "parking_notes": anything they say about where to leave a car',
    '  "floor_area": built area in square metres, where stated. Not land.',
    '  "timezone": IANA form — "Australia/Brisbane" — where the site makes',
    '    it obvious. Null rather than inferred from the country, since',
    '    several countries have more than one.',
    '  "setting_headline": their words for where it is',
    '  "street_address": null if not stated',
    '  "city": the town or city — Denpasar, Brisbane, Lisbon',
    '  "locality": the suburb, village or area, where they name one —',
    '    "Canggu", "Paddington", "the Tallebudgera Valley". Almost every',
    '    retreat is in one of these rather than in a city, and it is what',
    '    a guest searches for. Their wording, not a tidied version. Null',
    '    where the address only gives a city.',
    '  "state": state, province or region',
    '  "country": country name',
    '  "postcode": null if not stated',
    '  "contact_phone": as written',
    '  "contact_email": prefer bookings or enquiries over a personal address',
    '',
    '  "people": [ {',
    '    "first_name", "surname": only where the site names somebody. Do',
    '      NOT split a business name into a person. "Sarah at Willow',
    '      Retreat" is Sarah; "Willow Retreat" is nobody.',
    '    "role": what the site calls them — owner, retreat coordinator,',
    '      bookings manager, host. Their words, not a tidied version.',
    '    "email", "phone": theirs specifically, where given. Leave null',
    '      rather than repeating the general address.',
    '  } ]',
    '',
    '    Only people the site publishes as points of contact. Not',
    '      practitioners on a team page unless they take enquiries, not',
    '      testimonial names, not people in photograph captions.',
    '    An empty list is the right answer for most sites, and better',
    '      than a guess — writing to somebody who does not exist is worse',
    '      than writing to info@.',
    '  "website_url": their canonical address',
    '  "instagram_url", "facebook_url": full URLs or null',
    '  "max_guests": overnight capacity, NOT what a function room seats',
    '  "total_bedrooms", "total_bathrooms": numbers or null',
    '  "established_year": four digits only if stated',
    '  "property_size": number only, no unit',
    '  "property_size_unit": acres, hectares, m2 or sqft',
    '  "byo_facilitator_friendly": true only if the page says so, else null',
    '  "external_practitioners_welcome": same',
    '  "wifi_available", "pets_allowed", "children_allowed": true, false or null',
    '  "price_from": lowest number stated, no symbol',
    '  "price_currency": three-letter code',
    '',
    '  "room_types": [ {',
    '    "name", "quantity": how many of this room, "sleeps",',
    '    "bed_configuration": as written — "king or 2 x singles" is what a',
    '      retreat host needs to know, not "1 bed"',
    '    "beds": [ { "type", "quantity", "group" } ] — the same thing counted.',
    '      type must be one of: king, queen, double, king-single, single,',
    '      bunk, floor-mattress, sofa-bed, rollaway, futon, day-bed.',
    '      group matters: beds in the same group are in the room together;',
    '      different groups are alternatives. "One king OR two singles" is',
    '      group 1 with a king and group 2 with two singles — not three beds.',
    '      This is what lets a search answer "twelve beds, nobody sharing",',
    '      which is the question every retreat host asks.',
    '    "in_room_amenities": [ plain phrases as listed — "ensuite",',
    '      "freestanding bath", "private terrace", "kettle", "mosquito net" ]',
    '    "in_room_services": [ what can be had in the room rather than',
    '      walked to — breakfast, massage, turndown. Empty unless stated. ]',
    '    "bathroom_type": ensuite, private, shared, outdoor',
    '    "description": two sentences on what the room is like',
    '    "room_size", "room_size_unit": where stated',
    '    "outlook": ocean, garden, mountain, courtyard',
    '    "room_amenities": what is in the room — air conditioning, a bath,',
    '      a balcony, a kettle. As listed.',
    '    "is_accessible": true only if step-free access is stated',
    '    "image_url": a photograph of THIS room type, where one is clearly of it',
    '  } ]',
    '',
    '    Where a venue has more than one house or building, each is its own',
    '    entry with its own capacity — "Curraweena House sleeps 11" and',
    '    "Bell View House sleeps 7" are two records, not a total of 18.',
    '    Bed configuration matters: "doubles or 2 x singles" is what a',
    '    retreat host needs to know.',
    '',
    '  "spaces": [ {',
    '    "name", "space_type": shala, studio, barn, hall, deck, garden, cabin,',
    '      pavilion, dome, treatment room, or whatever they call it',
    '    "description": two sentences on what it is like to be in it —',
    '      what a guest would notice. Not a list of features.',
    '    "is_indoor": true/false/null, "is_covered": open sided counts as',
    '      covered but not indoor',
    '    "area", "area_unit": m2 or sqft',
    '    "flooring": timber, stone, polished concrete, matting, grass',
    '    "climate_control": air conditioned, fans, wood fire, open air',
    '    "lighting": natural light, dimmable, candles, skylights',
    '    "acoustics": anything said about sound — a dome, timber, sea noise',
    '    "view_type": what you see from inside it — ocean, garden, rice',
    '      fields, mountains',
    '    "outlook": which way it faces, where stated — sunrise, sunset, north',
    '    "equipment_provided": [ mats, bolsters, blocks, sound system,',
    '      projector, massage table — a list, not a sentence ]',
    '    "suitable_for": [ what they say it is used for ]',
    '    "step_free_access": true only if the site says this space can be',
    '      reached without steps. A venue can be step free at the entrance',
    '      and have every shala up a flight, which is the case a single',
    '      venue-wide answer hides.',
    '    "floor_level": where stated',
    '    "distance_from_accommodation_m": where stated, in metres',
    '    "path_surface": gravel, grass, boardwalk, sealed — where stated',
    '    "image_url": a photograph of THIS space, where one is clearly of it',
    '    "capacities": [ { "usage", "capacity" } ]',
    '  } ]',
    '',
    '    A space usually states more than one capacity and they are',
    '    different numbers. "Fits 18 for yoga or up to 40 for a sit down',
    '    workshop" is two entries, not one — 18 for yoga-mats and 40 for',
    '    seated-theatre. Record every figure given, each against what it is',
    '    a capacity FOR.',
    '',
    '    Usage must be one of these exactly:',
    '      yoga-mats            mats laid out, room to extend',
    '      meditation-cushions  seated on the floor',
    '      lying-down           breathwork, sound, nidra — arms out',
    '      standing-movement    dance, qigong',
    '      circle               seated in a ring',
    '      seated-theatre       chairs in rows facing one way',
    '      seated-tables        tables and chairs, workshop layout',
    '      standing-reception   nobody seated',
    '      dining               seated at a table for a meal',
    '      treatment-tables     massage tables with room to work',
    '      consultation         one practitioner, one guest',
    '',
    '    Do not convert between them. If only one figure is given, record',
    '    only that one — the rest can be worked out from floor area later,',
    '    and an estimate should be marked as one rather than passed off as',
    '    something the venue said.',
    '',
    '    Note anything limiting in the description. A treatment cabin with',
    '    no running water matters to whoever books it.',
    '',
    '  "packages": [ {',
    '    "name": as they call it — "Bamford Winter Warmer"',
    '    "tagline": their one line, if any',
    '    "price": number only',
    '    "currency": three letters',
    '    "duration_label": as written — "1.5 hrs", "half day"',
    '    "total_duration_minutes": that in minutes',
    '    "items": [ {',
    '      "name": each part separately. A ritual of three treatments is',
    '        three items, not one line of prose. Name each as the',
    '        treatment it is, so a package containing a hot stone massage',
    '        is findable by somebody searching for hot stone massage.',
    '      "duration_minutes": where each part has its own',
    '      "is_optional": true where the guest chooses between things',
    '    } ]',
    '    "available_months": [1-12] where it runs only part of the year.',
    '      A "Winter Warmer" is not a summer product. Null if year round.',
    '  } ]',
    '',
    '    Packages are how spas sell. Where a page lists a named ritual',
    '    with a price and a duration, that is a package — not a service.',
    '',
    '  "awards": [ {',
    '    "name": as stated — "MICHELIN Key", "Green Globe", "B Corp"',
    '    "level": where there is one — one key, five star, gold',
    '    "year": where stated',
    '  } ]',
    '',
    '    Only where the site says it in words. A logo in a footer with no',
    '    claim beside it is not something to repeat on their behalf.',
    '',
    '  "services": [ {',
    '    "name": as the menu writes it — "Sunset Sound Journey", not "sound bath"',
    '    "practice": what it actually IS, in plain words — sound bath,',
    '      Balinese massage, yoga nidra, forest bathing.',
    '',
    '      READ THE DESCRIPTION BEFORE DECIDING. The menu name is often',
    '      poetic and the description says what actually happens.',
    '',
    '      Be exact rather than close. If the thing is MORE SPECIFIC than',
    '      a general practice, say the specific thing:',
    '        "sulphuric mineral soak" — not "thermal bathing"',
    '        "volcanic mud bath" — not "mud treatment"',
    '        "jjimjilbang" — not "sauna"',
    '      A specific name recorded as a general one loses the detail for',
    '      good. Nobody reads "thermal bathing" and wonders what it used',
    '      to say. Being unmatched is recoverable; being wrongly matched',
    '      is not.',
    '',
    '      Strip venue decoration but keep qualifiers. "Sunset Sound Bath',
    '      in the Quantum Dome" is a sound bath — the dome is where, not',
    '      what. "Sulphuric Mineral Soak" is not a mineral soak, because',
    '      the sulphur is what it is.',
    '',
    '    "practice_confidence": "Certain" where the description leaves no',
    '      doubt, "Likely" where the name suggests it and the description',
    '      does not confirm, "Unsure" where you are guessing. Say Unsure',
    '      rather than choosing something near.',
    '    "duration_minutes": a number. "90 min" is 90. Where several',
    '      lengths are offered, take the shortest and list the rest in',
    '      duration_options.',
    '    "duration_options": ["60 min", "90 min", "120 min"] where offered',
    '    "price": the number only, no symbol and no thousands separator.',
    '      "IDR 450,000" is 450000.',
    '    "price_is_from": true where the menu says "from" — a starting',
    '      price treated as fixed misquotes the venue',
    '    "price_low", "price_high": where a range is given instead',
    '    "currency": three-letter code — IDR, AUD, EUR, THB',
    '    "couples_available": true only if stated',
    '    "in_room": true only if it can be had in the room',
    '    "description": one sentence, only where the menu gives one',
    '  } ]',
    '',
    '    Spa and treatment menus are where these live, and they usually',
    '    give a duration and a price for every line. Take them — a service',
    '    without either is far less useful than one with both.',
    '',
    '  "policies": [ { "type": one of arrival, cancellation, house rules,',
    '    payment, health and safety, "text": as written, condensed } ]',
    '',
    '  "facilities": [ plain phrases exactly as the venue writes them.',
    '    "Finnish sauna", "watsu pool", "meditation cave", "quantum sound',
    '    dome", "ducted air conditioning", "claw foot bathtub".',
    '',
    '    Do NOT categorise, tidy or standardise them. They are matched',
    '    against a catalogue afterwards, and anything unrecognised is kept',
    '    for review rather than discarded — a meditation cave in rural',
    '    Mexico is exactly the thing worth recording, and exactly the thing',
    '    a tidied phrase would lose.',
    '',
    '    Amenities, facilities and FAQ pages usually list these outright.',
    '    Include what is on the property, not what is nearby. ],',
    '',
    '  "capacity_note": how the numbers work where it is not one figure —',
    '    e.g. "up to 11 at the main house, or 18 using both properties",',
    '',
    '  ── the longer copy ──',
    '  ── climate and seasons ──',
    '  "climate_intro": what they say about their own climate that a',
    '    season table would not explain — shelter, altitude, prevailing',
    '    wind, why mornings are still. Their words, not a summary.',
    '  "climate_note": their closing line about timing, if they have one',
    '  "best_months": when they say is best to visit',
    '  "seasons": [ {',
    '    "season_name": Summer, Wet season, Dry season — as they name it',
    '    "months": "Dec to Feb"',
    '    "temp_low", "temp_high": numbers only',
    '    "temp_unit": "C" or "F"',
    '    "best_for": what they say the season suits',
    '    "is_peak": true where they call it peak or high season',
    '    "description": their sentence about it',
    '  } ]',
    '',
    '    Do NOT return a climate type. That is worked out from the',
    '    coordinates, and a page saying "sunny" is not a classification.',
    '',
    '  "venue_full_description": three or four paragraphs in their voice,',
    '    where the site has them. Not a rewrite — what they actually say.',
    '  "introduction_text": their opening line or two',
    '  "location_intro": how they describe getting there and what surrounds it',
    '  "accommodation_description": how they describe the rooms as a whole',
    '  "accommodation_style": e.g. "shared bungalows", "private villas"',
    '  "venue_highlights": [ up to 6 short phrases — what they lead with ]',
    '',
    '  ── numbers usually stated somewhere ──',
    '  "min_guests": smallest group they take',
    '  "day_guest_capacity": non-residential guests, where stated',
    '  "total_bathrooms", "private_ensuites", "shared_bathrooms"',
    '  "treatment_rooms": how many',
    '  "beds_king", "beds_queen", "beds_double", "beds_single", "beds_twin",',
    '    "beds_bunk", "beds_sofa": counts across the whole property, where',
    '    a site lists them. Null rather than adding up room types yourself.',
    '',
    '  ── arriving and staying ──',
    '  "check_in_time", "check_out_time": as written, e.g. "2pm", "10am"',
    '  "minimum_stay_nights": a number',
    '  "minimum_child_age": where children are limited rather than barred',
    '  "smoking_allowed": true, false or null',
    '  "languages": [ languages the staff speak, where stated ]',
    '',
    '  ── practicalities a host asks about ──',
    '  "wifi_details": where it reaches and where it does not',
    '  "wifi_coverage": e.g. "common areas only", "throughout"',
    '  "wifi_speed_mbps": a number, only if stated',
    '  "mobile_coverage": which networks work, where stated',
    '  "parking_type": e.g. "on site, free", "street"',
    '  "parking_spaces": a number',
    '  "nearest_transport": nearest airport, station or ferry with distance',
    '  "transport_access": [ ways to get there — "airport transfer",',
    '    "45 min drive from Denpasar", "ferry from the mainland" ]',
    '  "nearby_attractions": [ what is worth doing nearby ]',
    '  "please_bring": [ what guests are told to bring ]',
    '  "we_provide": [ what the venue supplies ]',
    '',
    '  ── who it suits ──',
    '  "best_for": [ short phrases — "yoga retreats", "corporate offsites" ]',
    '  "ideal_retreat_types": [ the kinds of retreat they say they host ]',
    '  "typical_group_profile": who usually comes',
    '  "byo_chef_permitted": true only if stated',
    '  "can_arrange_services": true if they arrange practitioners on request',
    '',
    '  ── the property itself ──',
    '  "property_type": e.g. "converted farmhouse", "purpose built"',
    '  "architecture_style": where distinctive',

    '  "pool_type": e.g. "heated saltwater", "natural"',
    '  "sustainability_practices": [ what they claim — solar, rainwater ]',
    '',
    '  ── access ──',
    '  "accessibility_summary": one or two sentences on step-free access,',
    '    where they say anything. Null if the site is silent — an inference',
    '    here could put someone in a place they cannot get into.',
    '  "step_free_entrance", "step_free_to_dining",',
    '  "step_free_to_practice_space": true ONLY where the site says so',
    '    plainly. Null otherwise. "Accessible" on its own does not mean',
    '    step free, and a photograph of a ramp is not a statement.',
    '  "accessible_parking": true only if stated',
    '  "access_path_notes": what they say about gradients, surfaces,',
    '    distances or where the steps are',
    '  "accessible_rooms", "accessible_bathrooms": numbers where stated',
    '  "elevator_access": true, false or null',
    '  "ground_floor_rooms": HOW MANY, not whether — a number or null',
    '  "first_aid_on_site", "defibrillator_on_site": true only if stated',
    '',
    '  "primary_image_url": the main photograph of the property',
    '',
    '  "flags": [ plain sentences about anything uncertain or worth checking ]',
    '}',
    '',
    'Empty arrays where a page says nothing. Do not invent rooms or services',
    'to fill them — an empty list is information, an invented one is not.',
    '',
    '── LENGTH ──',
    '',
    'Large resorts list a great deal, and an answer cut off halfway is worth',
    'nothing at all. So:',
    '',
    '  • At most 12 room types, 10 spaces, 20 services and 6 policies.',
    '    Where there are more, take the ones a retreat host would ask about',
    '    first and say so in flags — "lists roughly 40 spa treatments, the',
    '    20 most relevant are here".',
    '  • Descriptions of one or two sentences. This is a record, not a',
    '    brochure, and the venue\'s own page says it better anyway.',
    '  • Policies condensed to their substance. The cancellation terms in',
    '    three lines, not three paragraphs.',
  ].join('\n');
}

/* ── locations of a brand ────────────────────────────────────────── */

/** Links that look like other locations of the same brand.
 *
 *  AIRE lists eight bathhouses under a cities menu; Merse lists suburbs.
 *  Each is a real venue with its own address, hours and often its own
 *  services — so reading the home page alone records the brand and misses
 *  every venue.
 *
 *  Deliberately conservative. A false location creates a venue that does
 *  not exist, which is worse than missing one — so a link must look like
 *  a place, not merely be a link.
 */
const LOCATION_HINTS = [
  // A locations or cities menu, which is the reliable signal.
  /\b(locations?|cities|our-(spas?|centres?|clubs?|studios?|venues?|places?)|find-us|where-we-are|branches)\b/i,
];

/** Words that mean a page is about something else, however it is worded.
 *  A "gift cards" link in a locations menu is not a location. */
// Stems, not whole words. \bmember\b does not match "Memberships", which
// is exactly the link that got through the first time — the same fault as
// \bamenit\b failing on "amenities".
const NOT_A_LOCATION =
  /\b(gift|voucher|book|contact|about|blog|news|career|job|faq|term|privacy|shop|cart|login|account|member|press|media|franchise|invest|price|pricing|package|treatment|service|experience|offer|deal|event|team|staff|stor(e|y)|journal|recipe|guide)\w*/i;

export type BrandLocation = {
  url: string;
  label: string;
  /** How confident, since a wrong location creates a venue that does not
   *  exist. */
  confidence: 'Named in a locations menu' | 'Looks like a place';
};

/** Finds a venue's own logo in their HTML.
 *
 *  Read rather than asked for. A model given a page will produce a
 *  plausible logo URL that 404s, and a broken image on every venue screen
 *  is worse than no image — nobody can tell whether it failed to load or
 *  was never there.
 *
 *  Sources in order of how deliberate they are: a logo declared in
 *  structured data was put there on purpose; a favicon is whatever the
 *  theme shipped with.
 */
export function findLogo(html: string, baseUrl: string): {
  url: string | null;
  source: string | null;
} {
  const resolve = (href: string): string | null => {
    try {
      const u = new URL(href.trim(), baseUrl);
      return u.protocol.startsWith('http') ? u.href : null;
    } catch { return null; }
  };

  // Anything this small is a favicon pretending, and anything with these
  // words in the path is a payment badge or a social icon.
  const reject = new RegExp([
    'sprite', 'icon-', 'social', 'facebook', 'instagram', 'twitter',
    'linkedin', 'pinterest', 'youtube', 'tiktok',
    'visa', 'mastercard', 'paypal', 'stripe', 'tripadvisor',
    'placeholder', '1x1', 'pixel', 'spacer', 'blank', 'loading',
  ].join('|'), 'i');

  const candidates: { url: string; source: string }[] = [];

  // Structured data. The most deliberate of the lot — somebody typed it.
  for (const m of html.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const graph = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] ?? [])];
      for (const node of graph) {
        const logo = node?.logo?.url ?? node?.logo ?? node?.image?.url;
        if (typeof logo === 'string') {
          const u = resolve(logo);
          if (u && !reject.test(u)) candidates.push({ url: u, source: 'Structured data' });
        }
      }
    } catch { /* malformed JSON-LD is common and not worth failing over */ }
  }

  // An image in the header whose markup calls it a logo.
  const header = html.match(
    /<(header|nav)[^>]*>([\s\S]{0,6000}?)<\/\1>/i)?.[2] ?? html.slice(0, 12000);

  for (const m of header.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    if (!/logo|brand|wordmark|masthead/i.test(tag)) continue;
    // Every possible source, tried in turn. A lazy-loading theme puts a
    // base64 placeholder in src and the real image in data-src, so
    // taking src and giving up finds nothing on half of modern sites.
    const sources = [
      tag.match(/\ssrc=["']([^"']+)["']/i)?.[1],
      tag.match(/\sdata-src=["']([^"']+)["']/i)?.[1],
      tag.match(/\sdata-lazy-src=["']([^"']+)["']/i)?.[1],
      tag.match(/\ssrcset=["']([^"'\s,]+)/i)?.[1],
      tag.match(/\sdata-srcset=["']([^"'\s,]+)/i)?.[1],
    ].filter(Boolean) as string[];

    for (const src of sources) {
      if (src.startsWith('data:')) continue;
      const u = resolve(src);
      if (u && !reject.test(u)) {
        candidates.push({ url: u, source: 'Header image' });
        break;
      }
    }
  }

  // An SVG referenced from the header, which many modern sites use.
  for (const m of header.matchAll(/<(?:object|embed)[^>]+data=["']([^"']+\.svg)["']/gi)) {
    const u = resolve(m[1]);
    if (u && /logo|brand/i.test(u)) candidates.push({ url: u, source: 'Header image' });
  }

  // The touch icon, which is at least sized for a person to look at.
  const touch = html.match(
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i)?.[0];
  if (touch) {
    const href = touch.match(/href=["']([^"']+)["']/i)?.[1];
    const u = href && resolve(href);
    if (u) candidates.push({ url: u, source: 'Touch icon' });
  }

  // A favicon last. It is whatever the theme shipped with, and often a W
  // on a coloured square.
  const icon = html.match(
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/i)?.[0];
  if (icon) {
    const href = icon.match(/href=["']([^"']+)["']/i)?.[1];
    const u = href && resolve(href);
    if (u && !/\.ico$/i.test(u)) candidates.push({ url: u, source: 'Favicon' });
  }

  const best = candidates[0];
  return best ? { url: best.url, source: best.source } : { url: null, source: null };
}

/** What a brand calls itself, from its own markup.
 *
 *  Taken from the site rather than the domain, which is how "beaire.com"
 *  became a brand called "Beaire" and "sofitel.accor.com" became
 *  "Sofitel.accor". A domain is an address, not a name.
 *
 *  In order of how deliberate each source is: og:site_name is set by
 *  somebody typing the brand's name; a title is written for search
 *  engines and carries a tagline; a logo's alt text is often just "logo".
 */
export function findBrandName(html: string, fallbackDomain: string): string {
  const clean = (v: string) => v
    .replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, '\u2019')
    .replace(/\s+/g, ' ')
    .trim();

  // Somebody typed this for the brand specifically.
  const siteName = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1];
  if (siteName && siteName.length <= 60) return clean(siteName);

  // Structured data, where a site publishes an organisation.
  for (const m of html.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] ?? [])];
      for (const node of nodes) {
        const type = String(node?.['@type'] ?? '');
        if (!/Organization|Hotel|LocalBusiness|LodgingBusiness/i.test(type)) continue;
        const name = node?.name;
        if (typeof name === 'string' && name.length <= 60) return clean(name);
      }
    } catch { /* malformed JSON-LD is common */ }
  }

  // A title, minus whatever follows the separator — "Aman | Luxury
  // Resorts" is the brand and a promise, and only the first is a name.
  const title = html.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i)?.[1];
  if (title) {
    const first = clean(title).split(/\s+[|\u2013\u2014\u00b7-]\s+/)[0];
    if (first && first.length >= 2 && first.length <= 60
        && !/^home$|^welcome/i.test(first)) {
      return first;
    }
  }

  // The logo's alt text, where it says more than "logo".
  const alt = html.match(
    /<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]*alt=["']([^"']{2,60})["']/i)?.[1]
    ?? html.match(
    /<img[^>]+alt=["']([^"']{2,60})["'][^>]*(?:class|id)=["'][^"']*logo[^"']*["']/i)?.[1];
  if (alt && !/^logo$/i.test(alt.trim())) {
    return clean(alt.replace(/\s*logo\s*$/i, ''));
  }

  // The domain, which is where this started and the answer of last
  // resort.
  return fallbackDomain
    .replace(/\.(com|net|org|co|io)(\.[a-z]{2})?$/i, '')
    .replace(/[-.]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function discoverLocations(
  html: string, baseUrl: string, max = 20
): BrandLocation[] {
  let origin: string;
  try { origin = new URL(baseUrl).origin; } catch { return []; }

  const found = new Map<string, BrandLocation>();

  // Anchors inside a nav or list whose heading mentions locations. The
  // markup varies wildly, so this looks for the words near the links
  // rather than for a particular structure.
  const hasLocationMenu = LOCATION_HINTS.some((h) => h.test(html));

  for (const m of html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const linkText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!linkText || linkText.length > 40) continue;

    let url: URL;
    try { url = new URL(m[1], baseUrl); } catch { continue; }
    if (url.origin !== origin) continue;

    const path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '') continue;
    if (/\.(pdf|jpg|png|svg|webp|zip)$/i.test(path)) continue;
    if (NOT_A_LOCATION.test(path) || NOT_A_LOCATION.test(linkText)) continue;

    const key = origin + path.replace(/\/$/, '');
    if (found.has(key)) continue;

    // A place name is short, capitalised and not a verb phrase. Two words
    // at most — "New York" yes, "Book your visit" no.
    const looksLikePlace =
      /^[A-Z][a-zA-Zà-ÿ'’-]+(\s[A-Z][a-zA-Zà-ÿ'’-]+)?$/.test(linkText)
      && linkText.split(/\s+/).length <= 3;

    // The path itself often carries the brand and the city:
    // /en/aire-ancient-baths-newyork, /virginia/
    const shallow = path.split('/').filter(Boolean).length <= 2;

    if (!looksLikePlace || !shallow) continue;

    found.set(key, {
      url: key,
      label: linkText,
      confidence: hasLocationMenu
        ? 'Named in a locations menu'
        : 'Looks like a place',
    });

    if (found.size >= max) break;
  }

  return [...found.values()];
}
