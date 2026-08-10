/* ═══════════════════════════════════════════════════════════════════════
   WHAT THE HARVEST READS

   Every field either pass can propose, where it comes from, and where it
   lands. Declared in one place so the answer to "what does this fill in"
   is readable rather than something to be worked out from the code.

   The portal cross-checks this against the live schema, so a column that
   is renamed or removed shows up as a broken mapping instead of failing
   silently on apply — which is how "setting" was proposed for months
   against a column that did not exist.
   ═══════════════════════════════════════════════════════════════════════ */

export type HarvestField = {
  column: string;
  label: string;
  pass: 'Structured' | 'AI' | 'Both';
  /** Where on the page it comes from. */
  source: string;
  type: 'text' | 'number' | 'boolean' | 'reference';
  /** Why it can be trusted, or why it needs checking. */
  note?: string;
  /** Whether a wrong value here is visible or quiet. */
  risk?: 'low' | 'watch';
};

export const HARVEST_FIELDS: HarvestField[] = [
  /* ── structured: what the page publishes about itself ───────────── */
  { column: 'venue_name', label: 'Venue name', pass: 'Structured', type: 'text',
    source: 'schema.org name, or og:site_name',
    note: 'og:title often reads "Home | Venue Name" and is not used.' },

  { column: 'venue_short_description', label: 'Short description', pass: 'Both', type: 'text',
    source: 'meta description, og:description, or written by the AI pass',
    note: 'The AI version is usually better — a meta description is written for search engines.' },

  { column: 'street_address', label: 'Street address', pass: 'Structured', type: 'text',
    source: 'schema.org PostalAddress',
    note: 'Only from marked-up address blocks, never guessed from body text.' },

  { column: 'postcode', label: 'Postcode', pass: 'Structured', type: 'text',
    source: 'schema.org postalCode',
    note: 'Leading zeros are preserved — New Zealand postcodes lose them to numeric imports.' },

  { column: 'latitude', label: 'Latitude', pass: 'Structured', type: 'number',
    source: 'schema.org GeoCoordinates',
    note: 'Range-checked. A latitude outside −90 to 90 is discarded rather than proposed.' },

  { column: 'longitude', label: 'Longitude', pass: 'Structured', type: 'number',
    source: 'schema.org GeoCoordinates' },
  { column: 'maps_url', label: 'Their own map link', pass: 'Structured', type: 'text',
    source: 'Links to Google Maps or goo.gl',
    note: 'Kept as published. The map shown in the portal is generated from the coordinates instead, so it cannot drift out of step with a corrected address.' },

  { column: 'contact_phone', label: 'Phone', pass: 'Structured', type: 'text',
    source: 'tel: links and schema.org telephone',
    note: 'Compared as a number, so +61 405 400 696 and 61405400696 are not treated as different.' },

  { column: 'contact_email', label: 'Email', pass: 'Structured', type: 'text',
    risk: 'watch',
    source: 'mailto: links',
    note: 'Chosen from all addresses on the page: the venue\'s own domain first, then any other business address, then personal webmail — which is accepted but flagged.' },

  { column: 'primary_image_url', label: 'Primary image', pass: 'Structured', type: 'text',
    source: 'og:image',
    note: 'Logos and icons are excluded by filename and dimensions.' },

  { column: 'instagram_url', label: 'Instagram', pass: 'Structured', type: 'text',
    source: 'Links to instagram.com' },
  { column: 'facebook_url', label: 'Facebook', pass: 'Structured', type: 'text',
    source: 'Links to facebook.com' },
  { column: 'linkedin_url', label: 'LinkedIn', pass: 'Structured', type: 'text',
    source: 'Links to linkedin.com' },
  { column: 'youtube_url', label: 'YouTube', pass: 'Structured', type: 'text',
    source: 'Links to youtube.com' },
  { column: 'tiktok_url', label: 'TikTok', pass: 'Structured', type: 'text',
    source: 'Links to tiktok.com' },
  { column: 'tripadvisor_url', label: 'TripAdvisor', pass: 'Structured', type: 'text',
    source: 'Links to tripadvisor', note: 'Their existing reviews.' },
  { column: 'google_business_url', label: 'Google', pass: 'Structured', type: 'text',
    source: 'Links to a Google Maps or Business listing' },
  { column: 'booking_engine_url', label: 'Booking engine', pass: 'Structured', type: 'text',
    source: 'Links to a known booking platform',
    note: 'Which system holds their calendar — matters when availability sync arrives.' },
  { column: 'whatsapp_number', label: 'WhatsApp', pass: 'Structured', type: 'text',
    source: 'wa.me and wa.link links',
    note: 'Parsed from the path, which is where the number lives.' },
  { column: 'other_links', label: 'Other links', pass: 'Structured', type: 'text',
    source: 'Platforms with no field of their own',
    note: 'Xiaohongshu, WeChat, LINE, and listings on other marketplaces. Stored as JSON so a link is never discarded for having no column.' },

  /* ── AI: what needs the page read as prose ──────────────────────── */
  { column: 'venue_type_id', label: 'Venue type', pass: 'AI', type: 'reference',
    risk: 'watch',
    source: 'Chosen from the 37 catalogued types',
    note: 'Returns null rather than the nearest fit. Mapped from name to id on write.' },

  { column: 'max_guests', label: 'Maximum guests', pass: 'AI', type: 'number',
    risk: 'watch',
    source: 'Page text',
    note: 'Defined as overnight capacity, not what a function room seats — the two are often both stated and mean different things.' },

  { column: 'total_bedrooms', label: 'Bedrooms', pass: 'AI', type: 'number', source: 'Page text' },
  { column: 'total_bathrooms', label: 'Bathrooms', pass: 'AI', type: 'number', source: 'Page text' },

  { column: 'established_year', label: 'Established', pass: 'AI', type: 'number',
    source: 'Page text', note: 'Only where a four-digit year is stated outright.' },

  { column: 'setting_headline', label: 'Setting, in their words', pass: 'AI', type: 'text',
    source: 'Page text',
    note: 'Their phrasing, not a category. Also matched against the setting catalogue to fill the filterable values.' },

  { column: 'property_size', label: 'Property size', pass: 'AI', type: 'number',
    source: 'Page text', note: 'Number only. The unit is a separate field.' },
  { column: 'property_size_unit', label: 'Size unit', pass: 'AI', type: 'text',
    source: 'Page text', note: 'acres, hectares, m2 or sqft.' },

  { column: 'byo_facilitator_friendly', label: 'Own facilitators welcome', pass: 'AI',
    type: 'boolean', risk: 'watch',
    source: 'Page text',
    note: 'The instruction says explicitly not to infer this from the venue being a retreat centre. It is the field most likely to be filled in helpfully and wrongly.' },

  { column: 'external_practitioners_welcome', label: 'External practitioners', pass: 'AI',
    type: 'boolean', risk: 'watch', source: 'Page text',
    note: 'Same caution as above.' },

  { column: 'wifi_available', label: 'WiFi', pass: 'AI', type: 'boolean', source: 'Page text' },
  { column: 'pets_allowed', label: 'Pets', pass: 'AI', type: 'boolean',
    source: 'Page text', note: 'Only where the page states a position either way.' },
  { column: 'children_allowed', label: 'Children', pass: 'AI', type: 'boolean',
    source: 'Page text', note: 'Only where the page states a position either way.' },

  { column: 'price_from', label: 'From price', pass: 'AI', type: 'number',
    risk: 'watch', source: 'Page text',
    note: 'The lowest figure shown. Not converted, and a per-person rate can be mistaken for a nightly one.' },
  { column: 'price_currency', label: 'Currency', pass: 'AI', type: 'text',
    source: 'Page text', note: 'Three-letter code for the price above.' },
];

/** What the harvest does NOT attempt, and why. Recorded so the absence
 *  reads as a decision rather than an oversight. */
export const NOT_HARVESTED = [
  { what: 'Facilities and amenities',
    why: 'A catalogue of 226 items. A page mentioning a pool does not tell you whether it is heated, and a wrong tick is worse than a blank.' },
  { what: 'Practices and modalities',
    why: 'A venue listing yoga may host it, teach it, or simply have a room for it. Those are different offers.' },
  { what: 'Rooms and spaces',
    why: 'Needs a structured child record per space, not a value.' },
  { what: 'Availability and rates',
    why: 'Changes constantly and belongs to the venue, not to a scrape.' },
  { what: 'City, state and country',
    why: 'Resolved from the address against the geography tables, not read from the page.' },
];
