import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ItineraryPrint from '@/components/ItineraryPrint';
import { DOCUMENT_KINDS, resolveBranding } from '@/lib/documents';

export const dynamic = 'force-dynamic';

export default async function ItineraryPrintPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ audience?: string; branding?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const itineraryId = Number(id);
  const supabase = await createClient();

  const { data: itinerary } = await supabase
    .from('itineraries')
    .select('*, venues:base_venue_id(venue_name, cities(name), countries(name))')
    .eq('id', itineraryId).single();
  if (!itinerary) notFound();

  const [{ data: items }, { data: branding }] = await Promise.all([
    supabase.from('itinerary_items')
      .select('*, venues(venue_name, cities(name)), venue_spaces(name)')
      .eq('itinerary_id', itineraryId)
      .order('item_date').order('starts_at', { nullsFirst: true }).order('display_order'),
    itinerary.host_branding_id
      ? supabase.from('host_branding').select('*').eq('id', itinerary.host_branding_id).maybeSingle()
      : itinerary.contact_id
        ? supabase.from('host_branding').select('*').eq('contact_id', itinerary.contact_id).maybeSingle()
        : Promise.resolve({ data: null }),
  ]);

  const chosen = resolveBranding(
    sp.branding, itinerary, branding?.document_branding, DOCUMENT_KINDS.itinerary);

  return (
    <ItineraryPrint
      itinerary={itinerary}
      items={items ?? []}
      audience={sp.audience === 'internal' ? 'internal' : 'guest'}
      branding={chosen}
      hostBranding={branding ?? null}
    />
  );
}
