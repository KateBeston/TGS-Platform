import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EnquiryRecord from '@/components/EnquiryRecord';
import { searchOptions } from '@/app/actions/search';

export const dynamic = 'force-dynamic';

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enquiryId = Number(id);
  const supabase = await createClient();

  const { data: enquiry } = await supabase
    .from('enquiries').select('*, countries(iso_code)').eq('id', enquiryId).single();
  if (!enquiry) notFound();

  const [{ data: matches }, { data: countries }, { data: categories },
         { data: practices }, { data: outcomes }, { data: types },
         { data: reqTypes }, { data: requirements }, { data: dateOptions }] = await Promise.all([
    supabase.from('enquiry_venues')
      .select('*, venues(id,venue_name,slug,countries(name),cities(name))')
      .eq('enquiry_id', enquiryId).order('rank', { nullsFirst: false }),
    supabase.from('countries').select('id,name').order('name'),
    supabase.from('modality_categories').select('id,name').order('display_order'),
    supabase.from('modality_practices').select('id,name,category_id').order('name'),
    supabase.from('outcomes').select('id,name').order('display_order'),
    supabase.from('venue_types').select('id,name').order('name'),
    supabase.from('requirement_types').select('*').eq('is_active', true).order('display_order'),
    supabase.from('enquiry_requirements').select('*, venues(venue_name)')
      .eq('enquiry_id', enquiryId).order('display_order', { nullsFirst: false }).order('id'),
    supabase.from('enquiry_date_options').select('*')
      .eq('enquiry_id', enquiryId).order('preference'),
  ]);

  const opts = await searchOptions();

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/enquiries">Enquiries</Link> ·{' '}
        {enquiry.enquiry_reference ?? enquiry.enquiry_code ?? `#${enquiry.id}`}
      </div>

      <EnquiryRecord
        enquiry={enquiry}
        matches={matches ?? []}
        countries={countries ?? []}
        categories={categories ?? []}
        practices={practices ?? []}
        outcomes={outcomes ?? []}
        venueTypes={types ?? []}
        requirementTypes={reqTypes ?? []}
        requirements={requirements ?? []}
        dateOptions={dateOptions ?? []}
        searchOpts={opts}
        countryCode={(enquiry as any).countries?.iso_code ?? null}
      />
    </div></div>
  );
}
