import { headers } from 'next/headers';
import { feedsFor } from '@/app/actions/calendar';
import { createClient } from '@/lib/supabase/server';
import CalendarFeeds from '@/components/CalendarFeeds';

export const dynamic = 'force-dynamic';

export default async function AvailabilityPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);

  const supabase = await createClient();
  const [feeds, { data: roomTypes }, h] = await Promise.all([
    feedsFor(venueId),
    supabase.from('venue_room_types').select('id,name')
      .eq('venue_id', venueId).order('name'),
    headers(),
  ]);

  // Taken from the request rather than an environment variable, so a
  // preview deployment shows its own address instead of production's.
  const origin = `https://${h.get('host') ?? 'portal.theglobalsanctum.com'}`;

  return (
    <div className="content"><div className="wrap">
      <CalendarFeeds venueId={venueId} feeds={feeds}
                     roomTypes={roomTypes ?? []} origin={origin} />
    </div></div>
  );
}
