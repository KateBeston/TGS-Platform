import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MediaManager from '@/components/MediaManager';

export const dynamic = 'force-dynamic';

export default async function MediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name,venue_category').eq('id', venueId).single();
  if (!venue) notFound();

  const [{ data: placements }, { data: media }, { data: spaces }, { data: rooms }] =
    await Promise.all([
      supabase.from('media_placements').select('*').order('display_order'),
      supabase.from('venue_media').select('*').eq('venue_id', venueId)
        .order('display_order', { nullsFirst: false }).order('id'),
      supabase.from('venue_spaces').select('id,name').eq('venue_id', venueId).order('name'),
      supabase.from('venue_room_types').select('id,name').eq('venue_id', venueId).order('name'),
    ]);

  // The bucket is private, so a stored public URL returns 403. Signed URLs
  // are generated here, at display time, and expire — which is the whole
  // point of a private bucket: an unlisted venue's photographs are not
  // reachable by anyone who guesses a path, and access stops when a venue
  // leaves. Externally hosted images keep their own URL.
  const paths = (media ?? []).map((m: any) => m.storage_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();

  if (paths.length) {
    const { data: urls } = await supabase.storage
      .from('venue-media').createSignedUrls(paths, 60 * 60);   // one hour
    (urls ?? []).forEach((u: any) => {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    });
  }

  const withDisplay = (media ?? []).map((m: any) => ({
    ...m,
    display_url: m.storage_path ? signed.get(m.storage_path) ?? null : m.url,
  }));

  // Placements not relevant to this venue's category are hidden rather than
  // shown empty — a wellness day spa has no use for an excursion slot.
  const cat: string[] = venue.venue_category ?? [];
  const relevant = (placements ?? []).filter((p: any) =>
    p.applies_to === 'Both' || !cat.length || cat.includes(p.applies_to));

  return (
    <MediaManager
      venueId={venueId}
      placements={relevant}
      media={withDisplay}
      spaces={spaces ?? []}
      rooms={rooms ?? []}
    />
  );
}
