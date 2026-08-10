import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ItineraryBuilder from '@/components/ItineraryBuilder';

export const dynamic = 'force-dynamic';

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itineraryId = Number(id);
  const supabase = await createClient();

  const { data: itinerary } = await supabase
    .from('itineraries')
    .select('*, venues:base_venue_id(id,venue_name,country_id,countries(iso_code,name))')
    .eq('id', itineraryId).single();
  if (!itinerary) notFound();

  const [{ data: items }, { data: days }, { data: baseServices }] = await Promise.all([
    supabase.from('itinerary_items')
      .select('*, venues(id,venue_name,cities(name)), venue_services(name), venue_spaces(name)')
      .eq('itinerary_id', itineraryId)
      .order('item_date').order('starts_at', { nullsFirst: true }).order('display_order'),
    supabase.from('itinerary_days').select('*').eq('itinerary_id', itineraryId),
    itinerary.base_venue_id
      ? supabase.from('venue_services')
          .select('id,name,duration_minutes,base_price,currency')
          .eq('venue_id', itinerary.base_venue_id).order('name')
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        {itinerary.enquiry_id
          ? <><Link href={`/enquiries/${itinerary.enquiry_id}`}>Enquiry</Link> · Itinerary</>
          : 'Itinerary'}
      </div>

      <ItineraryBuilder
        itinerary={itinerary}
        items={items ?? []}
        days={days ?? []}
        baseServices={baseServices ?? []}
      />
    </div></div>
  );
}
