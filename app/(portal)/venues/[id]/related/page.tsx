import { notFound } from 'next/navigation';
import { alternatives } from '@/app/actions/curation';
import { createClient } from '@/lib/supabase/server';
import SimilarVenues from '@/components/SimilarVenues';
import RelatedEditor from '@/components/RelatedEditor';

export const dynamic = 'force-dynamic';

export default async function RelatedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name').eq('id', venueId).single();
  if (!venue) notFound();

  const { data: related } = await supabase
    .from('venue_related')
    .select('*, related:venues!venue_related_related_venue_id_fkey(id,venue_name,slug,countries(name))')
    .eq('venue_id', venueId)
    .order('display_order', { nullsFirst: false }).order('id');

  // What is calculated comes first, since pinning happens from it and
  // the manual list is the exception rather than the starting point.
  const suggested = await alternatives(venueId, 'Like this');

  return (
    <>
      <SimilarVenues venueId={venueId} initial={suggested} />
      <RelatedEditor venueId={venueId} rows={related ?? []} />
    </>
  );
}
