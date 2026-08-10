/* ═══════════════════════════════════════════════════════════════════════
   SETTING — RENDERED BY REGISTER

   One record, several voices. The same three statements read differently
   depending on who is reading and why:

     technical  — an internal or profile document. Formal labels, exact
                  distances, nothing implied. "Immediate: riverside,
                  farmland. Reachable: beach, 4.2 km."

     editorial  — a listing section. A label, a heading, a paragraph, and
                  pills. Written to be read, not scanned.

     card       — one line under a venue name in a list.

     filters    — the pills alone, for search.

   Assembled here rather than in SQL because wording is an editorial
   decision that will be revised, and revising it should not need a
   migration.
   ═══════════════════════════════════════════════════════════════════════ */

export type ProseParts = {
  immediate: string[] | null;
  immediate_detail: string[] | null;
  reachable: string[] | null;
  regional: string[] | null;
};

export type Register = 'technical' | 'editorial' | 'card' | 'filters';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function list(items: string[], join = 'and'): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${join} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} ${join} ${items[items.length - 1]}`;
}

/* ── technical ─────────────────────────────────────────────────────── */

/** For a venue profile or an internal document. Labelled, exact, and
 *  making no claim the record does not hold. A reader here wants to know
 *  what is recorded, not to be persuaded. */
export function renderTechnical(p: ProseParts): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  if (p.immediate?.length) {
    rows.push({ label: 'Immediate setting', value: p.immediate.join(' · ') });
  }
  if (p.regional?.length) {
    rows.push({ label: 'Regional character', value: p.regional.join(' · ') });
  }
  if (p.reachable?.length) {
    rows.push({ label: 'Within reach', value: p.reachable.join(' · ') });
  }
  return rows;
}

/* ── editorial ─────────────────────────────────────────────────────── */

export type EditorialSetting = {
  label: string;
  heading: string;
  body: string | null;
  pills: { text: string; kind: 'immediate' | 'reachable' | 'regional' }[];
};

/** For a listing section. The heading comes from what the venue is in,
 *  because that is what the place is; the body prefers the venue's own
 *  phrasing over anything assembled.
 *
 *  Returns a draft. It is meant to be edited — a listing that reads
 *  exactly like the one before it is worse than one written by hand. */
export function renderEditorial(p: ProseParts): EditorialSetting | null {
  const hasAnything = p.immediate?.length || p.reachable?.length || p.regional?.length;
  if (!hasAnything) return null;

  // The heading names the place rather than describing it.
  const heading = p.immediate?.length
    ? headingFor(p.immediate)
    : p.regional?.length
      ? `${p.regional[0]} country`
      : 'The setting';

  const sentences: string[] = [];

  if (p.immediate_detail?.length) {
    // The venue's own words, which are nearly always better.
    sentences.push(cap(p.immediate_detail[0].replace(/\.$/, '')) + '.');
  } else if (p.immediate?.length) {
    const where = list(p.immediate.map(lower));
    const region = p.regional?.length ? `, ${list(p.regional.map(lower))}` : '';
    sentences.push(cap(`set in ${where}${region}.`));
  }

  if (p.reachable?.length) {
    sentences.push(`${cap(list(p.reachable, 'and'))} ${p.reachable.length === 1 ? 'is' : 'are'} within reach.`);
  }

  return {
    label: 'The setting',
    heading,
    body: sentences.length ? sentences.join(' ') : null,
    pills: [
      ...(p.immediate ?? []).map((t) => ({ text: t, kind: 'immediate' as const })),
      ...(p.regional ?? []).map((t) => ({ text: t, kind: 'regional' as const })),
      ...(p.reachable ?? []).map((t) => ({ text: t, kind: 'reachable' as const })),
    ],
  };
}

/** Two settings make a phrase; more than two makes a list, and a list is
 *  not a heading. */
function headingFor(immediate: string[]): string {
  if (immediate.length === 1) return immediate[0];
  if (immediate.length === 2) return `${immediate[0]} and ${lower(immediate[1])}`;
  return `${immediate[0]}, ${lower(immediate[1])} and more`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── card ──────────────────────────────────────────────────────────── */

/** One line beneath a venue name. Immediate settings only — a card has
 *  room for what the place is, not for what it is near. */
export function renderCard(p: ProseParts): string | null {
  const parts = p.immediate?.length ? p.immediate : p.regional;
  return parts?.length ? parts.slice(0, 3).join(' · ') : null;
}

/* ── filters ───────────────────────────────────────────────────────── */

/** Everything, flat, for search. Reachable settings are included because
 *  a guest wanting a beach will accept one nearby — but they are marked,
 *  so the interface can say which is which. */
export function renderFilters(p: ProseParts) {
  return [
    ...(p.immediate ?? []).map((t) => ({ text: t, kind: 'immediate' as const })),
    ...(p.regional ?? []).map((t) => ({ text: t, kind: 'regional' as const })),
    ...(p.reachable ?? []).map((t) => ({ text: t, kind: 'reachable' as const })),
  ];
}

/* ── one entry point ───────────────────────────────────────────────── */

export function renderSetting(p: ProseParts, register: 'card'): string | null;
export function renderSetting(p: ProseParts, register: 'technical'): { label: string; value: string }[];
export function renderSetting(p: ProseParts, register: 'editorial'): EditorialSetting | null;
export function renderSetting(p: ProseParts, register: 'filters'): ReturnType<typeof renderFilters>;
export function renderSetting(p: ProseParts, register: Register): any {
  switch (register) {
    case 'technical': return renderTechnical(p);
    case 'editorial': return renderEditorial(p);
    case 'card':      return renderCard(p);
    case 'filters':   return renderFilters(p);
  }
}

/** Kept for the places that already call it. */
export function composeSentence(p: ProseParts): string | null {
  const e = renderEditorial(p);
  return e?.body ?? null;
}

/* ── labels by register ────────────────────────────────────────────── */

/** The same three relations, named for their audience.
 *
 *  Operational language in the portal — a field label is an instruction,
 *  and "What it is in" tells someone what to enter. Editorial language on
 *  a listing, where the reader is a guest deciding where to go. Formal
 *  language in a profile document, where a host is comparing venues and
 *  wants terms that mean the same thing on every page.
 *
 *  Kept together so the three cannot drift apart. */
export const RELATION_LABELS = {
  operational: {
    Immediate: {
      heading: 'What it is in',
      blurb: 'Standing on the property, this is what you see',
    },
    Reachable: {
      heading: 'What it can reach',
      blurb: 'Near enough to matter, not near enough to be the setting',
    },
    Regional: {
      heading: 'True of the region',
      blurb: 'Inherited from the city, and shared by every venue there',
    },
  },
  formal: {
    Immediate: { heading: 'Immediate setting', blurb: 'The property and its surrounds' },
    Reachable: { heading: 'Within reach', blurb: 'Accessible from the venue' },
    Regional:  { heading: 'Regional character', blurb: 'Conditions of the wider area' },
  },
  editorial: {
    Immediate: { heading: 'The setting', blurb: 'Where this place sits' },
    Reachable: { heading: 'Nearby', blurb: 'Worth the short journey' },
    Regional:  { heading: 'The region', blurb: 'The country it belongs to' },
  },
} as const;

/** A distance in the form a reader would say it. Under a kilometre in
 *  metres, above it in kilometres to one decimal — 4.2 km rather than
 *  4200 m, which nobody says aloud. */
export function distancePhrase(
  distanceM?: number | null,
  minutes?: number | null,
  mode?: string | null,
): string | null {
  if (minutes) {
    return `${minutes} min${mode ? ` ${mode.toLowerCase()}` : ''}`;
  }
  if (!distanceM) return null;
  if (distanceM < 100) return 'on the doorstep';
  if (distanceM < 1000) return `${Math.round(distanceM / 10) * 10} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}
