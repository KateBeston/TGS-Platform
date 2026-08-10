import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TaxonomyEditor from '@/components/TaxonomyEditor';

export const dynamic = 'force-dynamic';

export default async function TaxonomyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name,venue_category').eq('id', venueId).single();
  if (!venue) notFound();

  const [cats, practices, outcomes, audiences, formats,
         myCats, myPractices, myOutcomes, myAudiences] = await Promise.all([
    supabase.from('modality_categories').select('*').order('display_order').order('name'),
    supabase.from('modality_practices').select('*').order('display_order').order('name'),
    supabase.from('outcomes').select('id,name').order('display_order').order('name'),
    supabase.from('audiences').select('id,name').order('display_order').order('name'),
    supabase.from('formats').select('id,name').order('display_order').order('name'),
    supabase.from('venue_categories').select('category_id').eq('venue_id', venueId),
    supabase.from('venue_practices').select('practice_id').eq('venue_id', venueId),
    supabase.from('venue_outcomes').select('outcome_id').eq('venue_id', venueId),
    supabase.from('venue_audiences').select('audience_id').eq('venue_id', venueId),
  ]);

  // Only categories that apply to this venue's marketplace. A day spa has
  // no use for the retreat-only containers.
  const cat: string[] = venue.venue_category ?? [];
  const relevant = (cats.data ?? []).filter((c: any) =>
    !cat.length || (cat.includes('Retreat') && c.in_retreat) ||
                   (cat.includes('Wellness') && c.in_wellness));

  return (
    <TaxonomyEditor
      venueId={venueId}
      categories={relevant}
      practices={practices.data ?? []}
      outcomes={outcomes.data ?? []}
      audiences={audiences.data ?? []}
      formats={formats.data ?? []}
      myCategories={(myCats.data ?? []).map((r: any) => r.category_id)}
      myPractices={(myPractices.data ?? []).map((r: any) => r.practice_id)}
      myOutcomes={(myOutcomes.data ?? []).map((r: any) => r.outcome_id)}
      myAudiences={(myAudiences.data ?? []).map((r: any) => r.audience_id)}
    />
  );
}
