import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReviewsEditor from '@/components/ReviewsEditor';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name').eq('id', venueId).single();
  if (!venue) notFound();

  const { data: reviews } = await supabase
    .from('reviews').select('*').eq('venue_id', venueId)
    .order('stayed_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false });

  return <ReviewsEditor venueId={venueId} reviews={reviews ?? []} />;
}
