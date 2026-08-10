import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FacilitiesEditor from '@/components/FacilitiesEditor';

export const dynamic = 'force-dynamic';

export default async function FacilitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name,venue_category,venue_type_id').eq('id', venueId).single();
  if (!venue) notFound();

  const [{ data: cats }, { data: items }, { data: mine }, { data: relevance }] =
    await Promise.all([
      supabase.from('facility_categories').select('*').order('display_order').order('name'),
      supabase.from('facility_items').select('*').order('display_order').order('name'),
      supabase.from('venue_facilities').select('*').eq('venue_id', venueId),
      // Which of the 256 to show first. Ordering only — everything is
      // still available, because a venue with something unexpected must
      // be able to record it.
      venue.venue_type_id
        ? supabase.rpc('facilities_for_venue_type', { p_venue_type_id: venue.venue_type_id })
        : Promise.resolve({ data: null }),
    ]);

  const relevanceByItem = new Map(
    (relevance ?? []).map((r: any) => [r.facility_item_id, r.relevance]));

  const cat: string[] = venue.venue_category ?? [];
  const relevant = (cats ?? []).filter((c: any) =>
    c.applies_to === 'Both' || !cat.length || cat.includes(c.applies_to));

  return (
    <FacilitiesEditor
      venueId={venueId}
      categories={relevant}
      items={items ?? []}
      mine={mine ?? []}
      relevance={Object.fromEntries(relevanceByItem)}
    />
  );
}
