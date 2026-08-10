import { NextRequest, NextResponse } from 'next/server';
import { buildIcal } from '@/lib/ical';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/* A calendar somebody else fetches to know when a room is taken.
 *
 * Says nothing but that a period is unavailable. A guest's name and what
 * they paid are not another platform's business, and this address is
 * fetchable by anybody who has it.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: feed } = await supabase.from('calendar_feeds')
    .select('id,venue_id,room_type_id,room_id,is_active,venues(venue_name)')
    .eq('token', token).eq('direction', 'Publish').maybeSingle();

  // The same answer whether the token is wrong or switched off, so a
  // wrong guess learns nothing.
  if (!feed?.is_active) {
    return new NextResponse('Not found', { status: 404 });
  }

  let query = supabase.from('availability_blocks')
    .select('id,date_from,date_to,block_type,room_id,venue_rooms(room_type_id)')
    .eq('venue_id', feed.venue_id)
    // Only what genuinely holds a date. Maintenance and a seasonal
    // closure do too; a lapsed hold does not.
    .in('block_type', ['Booked', 'Held', 'Blocked', 'Maintenance', 'Seasonal Closure'])
    .gte('date_to', new Date().toISOString().slice(0, 10));

  if (feed.room_id) query = query.eq('room_id', feed.room_id);

  const { data: blocks } = await query;

  const relevant = (blocks ?? []).filter((b: any) =>
    !feed.room_type_id || b.venue_rooms?.room_type_id === feed.room_type_id);

  const name = (feed.venues as any)?.venue_name ?? 'Availability';

  const ical = buildIcal(
    relevant.map((b: any) => ({
      uid: `block-${b.id}`,
      from: b.date_from,
      to: b.date_to,
      label: 'Not available',
    })),
    `${name} — availability`,
  );

  await supabase.from('calendar_feeds')
    .update({ last_synced_at: new Date().toISOString(), last_sync_status: 'Fetched' })
    .eq('id', feed.id);

  return new NextResponse(ical, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="availability.ics"`,
      // Fetched every few hours by most platforms; caching longer than
      // that publishes dates that have since been taken.
      'cache-control': 'public, max-age=900',
    },
  });
}
