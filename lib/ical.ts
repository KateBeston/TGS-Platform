/** Reading and writing iCalendar.
 *
 *  The format is old and the implementations vary, so this parses
 *  defensively rather than to the letter of RFC 5545 — Airbnb, Booking
 *  and Google all produce valid files that differ in what they leave out.
 */

export type CalEvent = {
  uid: string;
  summary: string | null;
  from: string;   // YYYY-MM-DD
  to: string;     // exclusive, as iCal means it
  raw: string;
};

/** Undoes the line folding the format requires.
 *
 *  A long line is split at 75 octets and continued with a leading space
 *  or tab. Parsing without unfolding first silently truncates every long
 *  summary, which is where a booking reference usually lives. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter(Boolean);
}

/** A date from either form iCal uses.
 *
 *  DTSTART;VALUE=DATE:20260814 for a whole day, or
 *  DTSTART:20260814T140000Z with a time. Accommodation feeds use the
 *  first; a calendar app may use the second for the same thing. */
function toDate(value: string): string | null {
  const clean = value.trim();
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseIcal(text: string): CalEvent[] {
  const lines = unfold(text);
  const events: CalEvent[] = [];

  let current: Record<string, string> | null = null;
  let raw: string[] = [];

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { current = {}; raw = [line]; continue; }

    if (line.startsWith('END:VEVENT')) {
      if (current) {
        raw.push(line);
        const from = toDate(current.DTSTART ?? '');
        const to = toDate(current.DTEND ?? '');

        // An event with no start is not an event. One with no end is a
        // single day, which is what a one-night block looks like from
        // some systems.
        if (from) {
          events.push({
            // A feed with no UID is out of spec and exists. Keyed on the
            // dates instead, which is stable enough to match on later.
            uid: current.UID || `${from}-${to ?? from}`,
            summary: current.SUMMARY ?? null,
            from,
            to: to ?? addDay(from),
            raw: raw.join('\n'),
          });
        }
      }
      current = null;
      continue;
    }

    if (!current) continue;
    raw.push(line);

    // Properties carry parameters before the colon —
    // DTSTART;VALUE=DATE:20260814 — and the name is what precedes the
    // first semicolon or colon.
    const at = line.indexOf(':');
    if (at === -1) continue;
    const name = line.slice(0, at).split(';')[0].toUpperCase();
    const value = line.slice(at + 1);
    current[name] = value;
  }

  return events;
}

function addDay(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Writes a feed of blocks for somebody else to read.
 *
 *  Deliberately says nothing but that a period is taken. A guest's name
 *  and what they paid are not another platform's business, and a feed is
 *  fetched by anybody holding the address.
 */
export function buildIcal(
  blocks: { from: string; to: string; uid: string; label?: string }[],
  calendarName: string,
): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Global Sanctum//Availability//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(calendarName)}`,
  ];

  for (const b of blocks) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.uid}@theglobalsanctum.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${b.from.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${b.to.replace(/-/g, '')}`,
      `SUMMARY:${escape(b.label ?? 'Not available')}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  // Folded at 75 octets, since a reader that respects the spec will
  // truncate anything longer.
  return lines.map(fold).join('\r\n') + '\r\n';
}

function escape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

/** An invitation, which is a different thing from a feed.
 *
 *  METHOD:REQUEST with an ORGANIZER and an ATTENDEE is what makes Gmail,
 *  Outlook and Apple Mail render Yes and No buttons in the message
 *  itself. METHOD:PUBLISH — what a feed uses — renders as an attachment
 *  nobody opens.
 *
 *  The venue taps once and it is a real event in their own calendar,
 *  editable, not a copy of ours. TGS cannot write into their calendar and
 *  this does not pretend to; it asks, and they agree.
 */
export function buildInvite(opts: {
  uid: string;
  from: string;            // YYYY-MM-DD
  to: string;              // exclusive
  summary: string;
  description?: string;
  location?: string;
  organiserName: string;
  organiserEmail: string;
  attendeeName?: string;
  attendeeEmail: string;
  /** Rises by one each time the same booking is sent again. A calendar
   *  ignores an update whose sequence has not moved. */
  sequence?: number;
  cancelled?: boolean;
}): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Global Sanctum//Bookings//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${opts.cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${opts.uid}@theglobalsanctum.com`,
    `SEQUENCE:${opts.sequence ?? 0}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${opts.from.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${opts.to.replace(/-/g, '')}`,
    `SUMMARY:${esc(opts.summary)}`,
    `ORGANIZER;CN=${esc(opts.organiserName)}:mailto:${opts.organiserEmail}`,
    // RSVP=TRUE is what asks for an answer. Without it the invite shows
    // as information rather than a question.
    `ATTENDEE;CN=${esc(opts.attendeeName ?? opts.attendeeEmail)};`
      + `ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:`
      + `mailto:${opts.attendeeEmail}`,
    `STATUS:${opts.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
  ];

  if (opts.description) lines.push(`DESCRIPTION:${esc(opts.description)}`);
  if (opts.location) lines.push(`LOCATION:${esc(opts.location)}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function esc(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) { parts.push(' ' + rest.slice(0, 74)); rest = rest.slice(74); }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}
