import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import VenueServicesEditor from '@/components/VenueServicesEditor';
import { venueServices, taxonomyOptions, venueMapping } from '@/app/actions/venueServices';

export const dynamic = 'force-dynamic';

export default async function VenueServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name').eq('id', venueId).single();
  if (!venue) notFound();

  const [services, { categories, practices }, mapping] = await Promise.all([
    venueServices(venueId),
    taxonomyOptions(),
    venueMapping(venueId),
  ]);

  return (
    <VenueServicesEditor
      venueId={venueId}
      services={services as any}
      categories={categories as any}
      practices={practices as any}
      mapping={mapping}
    />
  );
}
