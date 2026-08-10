/** Names a practice the way the taxonomy already does.
 *
 *  A website writes "ROOFTOP INFRARED SAUNA RITUAL" or "sulphuric
 *  mineral soak" and neither belongs in a list beside "Japanese Onsen"
 *  and "Hammam & Ritual Bathing". Left raw, the taxonomy becomes a
 *  record of how each website happened to style its menu.
 */

/** Lowercase inside a name, capitalised at the start. Matches the
 *  existing entries — "Steam & Sauna Rituals", "Flotation & REST". */
const SMALL = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'of', 'on', 'or', 'the', 'to', 'with', 'via',
]);

/** Kept as written, because title-casing them makes them wrong.
 *  "Flotation & Rest" is a different thing from "Flotation & REST". */
const ACRONYMS = new Set([
  'REST', 'LED', 'PEMF', 'TMJ', 'IV', 'CBD', 'THC', 'EMDR', 'NLP', 'TRE',
  'CST', 'MLD', 'IASTM', 'PNF', 'HIIT', 'EFT', 'ACT', 'CBT', 'DBT',
  'TCM', 'AYUR', 'UV', 'RF', 'EMS', 'TENS', 'HBOT', 'NAD',
]);

/** Words a venue adds that describe the occasion rather than the
 *  practice. Stripped, because "Sunset Sound Bath Experience" and
 *  "Sound Bath" are the same practice and should not be two rows. */
const DECORATION = new Set([
  'experience', 'journey', 'session', 'treatment', 'ritual', 'signature',
  'bespoke', 'exclusive', 'ultimate', 'premium', 'deluxe', 'luxury',
  'our', 'sunset', 'sunrise', 'morning', 'evening', 'rooftop', 'private',
  'group', 'introductory', 'complimentary', 'special', 'new',
]);

export function titleCasePractice(raw: string): string {
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .trim()
    // A trailing duration or price is menu formatting, not a name.
    .replace(/\s*[–—-]\s*\d+\s*(min|mins|minutes|hr|hrs|hours)\b.*$/i, '')
    .replace(/\s*\(\s*\d+\s*(min|mins|minutes|hr|hrs|hours)[^)]*\)\s*$/i, '')
    .replace(/\s*[·|]\s*.*$/, '')
    .trim();

  const words = cleaned.split(' ').filter(Boolean);

  return words.map((word, i) => {
    const bare = word.replace(/[^\w&]/g, '');

    if (ACRONYMS.has(bare.toUpperCase()) && bare.length <= 5) {
      return word.replace(bare, bare.toUpperCase());
    }
    if (word === '&' || word === '-') return word;

    const lower = word.toLowerCase();
    // Small words stay small unless they open or close the name.
    if (i > 0 && i < words.length - 1 && SMALL.has(lower.replace(/[^\w]/g, ''))) {
      return lower;
    }
    // Hyphenated parts each get a capital — "Wim-Hof", "Self-Massage".
    return lower.replace(/(^|[-/])(\w)/g, (_, sep, ch) => sep + ch.toUpperCase());
  }).join(' ');
}

/** A suggested name with the venue's decoration removed.
 *
 *  Only offered — the raw phrase is kept alongside so a genuine
 *  qualifier is never silently discarded. "Sulphuric" is not decoration
 *  and would survive; "Rooftop" is and would not.
 */
export function suggestPracticeName(raw: string): {
  suggested: string;
  removed: string[];
} {
  const titled = titleCasePractice(raw);
  const words = titled.split(' ');

  // Only stripped from the ends. A decoration word in the middle is
  // usually part of the name — "Hammam & Ritual Bathing" is a real
  // practice and losing "Ritual" from it makes it a different one.
  // "Rooftop Infrared Sauna Ritual" wraps the practice in decoration at
  // both ends, which is the pattern worth removing.
  let start = 0;
  let end = words.length;
  const removed: string[] = [];

  const isDecoration = (w: string) =>
    DECORATION.has(w.toLowerCase().replace(/[^\w]/g, ''));

  while (start < end - 1 && isDecoration(words[start])) {
    removed.push(words[start]); start++;
  }
  while (end > start + 1 && isDecoration(words[end - 1])) {
    removed.push(words[end - 1]); end--;
  }

  const kept = words.slice(start, end);

  // If stripping leaves nothing meaningful, the decoration was the name.
  const suggested = kept.length >= 1 ? kept.join(' ').trim() : titled;

  return { suggested: suggested || titled, removed };
}
