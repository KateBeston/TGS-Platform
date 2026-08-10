import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════
   ITINERARY EXPORT

   ?format=ics  — an iCalendar file. Every item becomes an event with its
                  venue as the location, so a host can drop the whole
                  programme into Google Calendar, Outlook or Apple Calendar
                  and have it on their phone. This is the format people
                  actually use day to day.

   ?format=csv  — a spreadsheet, for anyone who wants to work on it
                  elsewhere or hand it to a venue in their own format.

   PDF is deliberately absent: the print view produces one from the browser
   without adding a headless renderer to the deployment.
   ═══════════════════════════════════════════════════════════════════════ */

/** iCalendar wants escaped commas and semicolons, CRLF line endings, and
 *  lines folded at 75 octets. Parsers are strict about all three. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
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

/** Local time with no Z suffix, paired with the venue's timezone where we
 *  know it. A session at 7am means 7am there, not 7am UTC. */
function stamp(date: string, time: string | null): string {
  const d = String(date).replace(/-/g, '');
  if (!time) return d;
  return `${d}T${String(time).slice(0, 5).replace(':', '')}00`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const itineraryId = Number(id);
  const format = req.nextUrl.searchParams.get('format') ?? 'ics';

  const supabase = await createClient();

  const { data: itinerary } = await supabase
    .from('itineraries')
    .select('*, venues:base_venue_id(venue_name, cities(name, timezone), countries(name))')
    .eq('id', itineraryId).single();

  if (!itinerary) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const { data: items } = await supabase
    .from('itinerary_items')
    .select('*, venues(venue_name, street_address, cities(name), countries(name))')
    .eq('itinerary_id', itineraryId)
    .order('item_date').order('starts_at', { nullsFirst: true });

  const rows = items ?? [];
  const slug = String(itinerary.name ?? 'itinerary')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'itinerary';

  /* ── CSV ────────────────────────────────────────────────────────── */
  if (format === 'csv') {
    const cell = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Date', 'Start', 'End', 'Duration (min)', 'Type', 'Title',
      'Venue', 'Location', 'Participants', 'Price per person', 'Total',
      'Included', 'Status', 'Travel to next (min)', 'Notes'];

    const lines = [header.join(',')];
    for (const r of rows as any[]) {
      lines.push([
        r.item_date,
        r.starts_at ? String(r.starts_at).slice(0, 5) : '',
        r.ends_at ? String(r.ends_at).slice(0, 5) : '',
        r.duration_minutes ?? '',
        r.item_type,
        r.title,
        r.venues?.venue_name ?? (itinerary as any).venues?.venue_name ?? '',
        r.location_note ?? r.venues?.cities?.name ?? '',
        r.participant_count ?? itinerary.guest_count ?? '',
        r.price_per_person ?? '',
        r.price_total ?? '',
        r.is_included ? 'Included' : '',
        r.booking_status,
        r.travel_minutes_to_next ?? '',
        r.notes ?? '',
      ].map(cell).join(','));
    }

    return new NextResponse(lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.csv"`,
      },
    });
  }

  /* ── iCalendar ──────────────────────────────────────────────────── */
  const tz = (itinerary as any).venues?.cities?.timezone ?? null;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const out: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Global Sanctum//Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(String(itinerary.name ?? 'Itinerary'))}`),
  ];
  if (tz) out.push(`X-WR-TIMEZONE:${tz}`);

  for (const r of rows as any[]) {
    const venue = r.venues?.venue_name ?? (itinerary as any).venues?.venue_name;
    const place = [
      venue,
      r.venues?.street_address,
      r.venues?.cities?.name,
      r.venues?.countries?.name,
      r.location_note,
    ].filter(Boolean).join(', ');

    const allDay = r.is_all_day || !r.starts_at;
    const dtParam = allDay ? ';VALUE=DATE' : tz ? `;TZID=${tz}` : '';

    // An all-day event's DTEND is exclusive, so it is the following day.
    const endDate = allDay
      ? new Date(new Date(r.item_date).getTime() + 86_400_000).toISOString().slice(0, 10)
      : null;

    const description = [
      r.description,
      r.item_type !== 'Service' ? `Type: ${r.item_type}` : null,
      r.participant_count ? `Participants: ${r.participant_count}` : null,
      r.booking_status !== 'Confirmed' ? `Status: ${r.booking_status}` : null,
      r.travel_minutes_to_next
        ? `Allow ${r.travel_minutes_to_next} minutes travel afterwards` : null,
      r.notes,
    ].filter(Boolean).join('\n');

    out.push('BEGIN:VEVENT');
    out.push(`UID:tgs-itin-${itineraryId}-item-${r.id}@theglobalsanctum.com`);
    out.push(`DTSTAMP:${now}`);
    out.push(`DTSTART${dtParam}:${
      allDay ? String(r.item_date).replace(/-/g, '') : stamp(r.item_date, r.starts_at)}`);
    out.push(`DTEND${dtParam}:${
      allDay ? String(endDate).replace(/-/g, '')
        : stamp(r.item_date, r.ends_at ?? r.starts_at)}`);
    out.push(fold(`SUMMARY:${esc(r.title)}`));
    if (place) out.push(fold(`LOCATION:${esc(place)}`));
    if (description) out.push(fold(`DESCRIPTION:${esc(description)}`));
    // Anything unconfirmed is TENTATIVE, so a host's own calendar shows the
    // difference between a plan and a booking.
    out.push(`STATUS:${
      r.booking_status === 'Confirmed' ? 'CONFIRMED'
        : r.booking_status === 'Cancelled' ? 'CANCELLED' : 'TENTATIVE'}`);
    if (r.is_optional) out.push('TRANSP:TRANSPARENT');
    out.push('END:VEVENT');
  }

  out.push('END:VCALENDAR');

  return new NextResponse(out.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
    },
  });
}
