import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EnquiryBrief from '@/components/EnquiryBrief';

export const dynamic = 'force-dynamic';

export default async function BriefPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ audience?: string }>;
}) {
  const { id } = await params;
  const { audience } = await searchParams;
  const enquiryId = Number(id);
  const supabase = await createClient();

  const { data: enquiry } = await supabase
    .from('enquiries')
    .select('*, countries(name), modality_categories(name), modality_practices(name), outcomes(name), venue_types(name)')
    .eq('id', enquiryId).single();
  if (!enquiry) notFound();

  const [{ data: dates }, { data: requirements }, { data: matches }] = await Promise.all([
    supabase.from('enquiry_date_options').select('*').eq('enquiry_id', enquiryId).order('preference'),
    supabase.from('enquiry_requirements')
      .select('*, requirement_types(label)').eq('enquiry_id', enquiryId)
      .order('is_essential', { ascending: false }).order('display_order', { nullsFirst: false }),
    supabase.from('enquiry_venues')
      .select('*, venues(id,venue_name,slug,countries(name),cities(name),max_guests,price_from)')
      .eq('enquiry_id', enquiryId).order('rank', { nullsFirst: false }),
  ]);

  return (
    <EnquiryBrief
      enquiry={enquiry}
      dates={dates ?? []}
      requirements={requirements ?? []}
      matches={matches ?? []}
      audience={audience === 'host' ? 'host' : 'venue'}
    />
  );
}
