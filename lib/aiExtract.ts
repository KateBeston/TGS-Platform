/* ═══════════════════════════════════════════════════════════════════════
   AI EXTRACTION

   The second pass. The structured-data harvest reads what a page states
   about itself in machine-readable form; this reads the page as prose and
   works out the things that need judgement — venue type, capacity, a
   description, what a host may bring.

   Haiku is the model, deliberately. Anthropic's own guidance puts
   classification and extraction in Haiku's territory, it is the cheapest
   current model, and this is a task with a right answer rather than one
   needing reasoning. Sonnet would cost three times as much to do the same
   job slightly more elegantly.

   The whole pass over 1,294 venues is roughly $10 batched.
   ═══════════════════════════════════════════════════════════════════════ */

export const EXTRACTION_MODEL = 'claude-haiku-4-5-20251001';

/** Strips a page to readable text. This is the single biggest lever on
 *  cost: raw HTML is mostly markup, and sending it would multiply the
 *  token count several times over for no gain. */
export function pageToText(html: string, limit = 24000): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Headings and list items carry structure worth keeping, so they get
    // a line break rather than being run together.
    .replace(/<\/(h[1-6]|p|li|div|tr|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Navigation and cookie notices repeat on every page and say nothing
  // about the venue.
  text = text.split('\n')
    .filter((line) => {
      const l = line.trim().toLowerCase();
      if (l.length < 2) return false;
      if (/^(home|about|contact|menu|search|login|book now|close|skip to)$/.test(l)) return false;
      if (/cookie|consent|privacy policy|terms of use|all rights reserved/.test(l)
          && l.length < 120) return false;
      return true;
    })
    .join('\n');

  return text.length > limit ? text.slice(0, limit) + '\n[truncated]' : text;
}

export type ExtractionField = {
  column: string;
  label: string;
  instruction: string;
};

/** What the model is asked for. Each field says plainly what counts as an
 *  answer, because "capacity" without qualification returns the function
 *  room's seated capacity as often as the number of beds. */
export const EXTRACTION_FIELDS: ExtractionField[] = [
  { column: 'venue_type_name', label: 'Venue type',
    instruction: 'Exactly one value from the list provided. If none fits well, return null rather than the closest.' },
  { column: 'venue_short_description', label: 'Short description',
    instruction: 'Two sentences describing what this place is and what distinguishes it. Plain, specific, no marketing adjectives. Australian spelling.' },
  { column: 'max_guests', label: 'Maximum guests',
    instruction: 'How many people can STAY overnight, not how many a function room seats. Number only, null if not stated.' },
  { column: 'total_bedrooms', label: 'Bedrooms',
    instruction: 'Number of bedrooms available to guests. Null if not stated.' },
  { column: 'total_bathrooms', label: 'Bathrooms',
    instruction: 'Number of bathrooms. Null if not stated.' },
  { column: 'established_year', label: 'Established',
    instruction: 'Four-digit year the venue opened or the building dates from, only if explicitly stated.' },
  { column: 'setting_headline', label: 'Setting, in the venue\'s words',
    instruction: 'One short phrase as the page describes its location, e.g. "at the foothills of the Blue Mountains", "steps from Seminyak beach". Their words, not a category. Null if the page does not describe where it is.' },
  { column: 'property_size', label: 'Property size',
    instruction: 'Land area as a NUMBER only, no unit. 12 for "12 acres". Null if not stated.' },
  { column: 'property_size_unit', label: 'Property size unit',
    instruction: 'The unit for the number above: acres, hectares, m2, or sqft. Null if no size given.' },
  { column: 'byo_facilitator_friendly', label: 'Own facilitators welcome',
    instruction: 'True only if the page says hosts may bring their own teachers or run their own programme. Null if not mentioned — do not infer from the venue being a retreat centre.' },
  { column: 'external_practitioners_welcome', label: 'External practitioners',
    instruction: 'True only if explicitly stated. Null if not mentioned.' },
  { column: 'wifi_available', label: 'WiFi',
    instruction: 'True if WiFi is mentioned as available. Null if not mentioned.' },
  { column: 'pets_allowed', label: 'Pets',
    instruction: 'True or false only if the page states a position. Null if not mentioned.' },
  { column: 'children_allowed', label: 'Children',
    instruction: 'True or false only if the page states a position. Null if not mentioned.' },
  { column: 'price_from', label: 'From price',
    instruction: 'The lowest nightly or per-person price stated, as a number with no symbol. Null if no price is shown.' },
  { column: 'price_currency', label: 'Currency',
    instruction: 'Three-letter code for the price above, e.g. AUD, IDR, EUR. Null if no price.' },
];

export function buildPrompt(venueTypes: string[]): string {
  return [
    'You are reading a wellness or retreat venue\'s own website and extracting facts about it.',
    '',
    'Rules that matter more than completeness:',
    '',
    '1. Only state what the page actually says. Null is a correct answer and',
    '   a far better one than a guess. A venue with no capacity stated is not',
    '   a venue with an unknown capacity you should estimate.',
    '2. Do not infer from category. A retreat centre does not necessarily',
    '   welcome external facilitators; say null unless the page says so.',
    '3. Ignore other properties. Some sites list sister venues or nearby',
    '   places — extract only the venue this page is about.',
    '4. Prices are often "from" figures. Take the lowest stated and note the',
    '   currency; do not convert.',
    '',
    'Venue types — choose exactly one or null:',
    venueTypes.map((t) => `  ${t}`).join('\n'),
    '',
    'Return only a JSON object with these keys, no preamble, no markdown:',
    '',
    EXTRACTION_FIELDS.map((f) => `  "${f.column}": ${f.instruction}`).join('\n'),
    '',
    'Add a "confidence" key: "high" if the page states things plainly,',
    '"medium" if you inferred from context, "low" if the page is thin or',
    'mostly images.',
  ].join('\n');
}
