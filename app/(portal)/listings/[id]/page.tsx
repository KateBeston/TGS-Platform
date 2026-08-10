import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ListingEditor from '@/components/ListingEditor';

export const dynamic = 'force-dynamic';

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = Number(id);
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('venue_listings').select('*').eq('id', listingId).single();

  if (!listing) {
    return <div className="content"><div className="note bad">Listing record not found.</div></div>;
  }

  const [{ data: venue }, { data: types }] = await Promise.all([
    supabase.from('venues')
      .select('id,venue_name,max_guests,total_bedrooms,venue_type_id,countries(name),states(name),cities(name)')
      .eq('id', listing.venue_id).single(),
    supabase.from('venue_types').select('id,name').order('name'),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/listings">Listings</Link> · {listing.headline ?? 'Untitled'}
      </div>
      <ListingEditor listing={listing} venue={venue} types={types ?? []} />
    </div></div>
  );
}
