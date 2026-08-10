import { notFound } from 'next/navigation';
import { enquiry } from '@/app/actions/concierge';
import { listSavedSearches, searchOptions } from '@/app/actions/search';
import { createClient } from '@/lib/supabase/server';
import EnquirySteps from '@/components/EnquirySteps';

export const dynamic = 'force-dynamic';

export default async function EnquiryPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await enquiry(Number(id));
  if (!e) notFound();

  const supabase = await createClient();
  const [options, saved, { data: hostTypes }, { data: categories },
         { data: outcomes }, { data: audiences }, { data: formats },
         { data: countries }] = await Promise.all([
    searchOptions(),
    listSavedSearches(),
    supabase.from('host_types').select('id,name').eq('is_active', true)
      .order('display_order'),
    supabase.from('modality_categories').select('id,name')
      .eq(e.enquiry_type === 'Retreat Host' ? 'in_retreat' : 'in_wellness', true)
      .order('display_order'),
    supabase.from('retreat_outcomes').select('id,name')
      .eq('is_active', true).order('display_order'),
    supabase.from('retreat_audiences').select('id,name')
      .eq('is_active', true).order('display_order'),
    supabase.from('retreat_formats').select('id,name')
      .eq('is_active', true).order('display_order'),
    supabase.from('countries').select('id,name').order('name'),
  ]);

  return (
    <div className="content"><div className="wrap">
      <EnquirySteps
        enquiry={e}
        hostTypes={hostTypes ?? []}
        categories={categories ?? []}
        outcomes={outcomes ?? []}
        audiences={audiences ?? []}
        formats={formats ?? []}
        countries={countries ?? []}
        searchOptions={options}
        savedSearches={saved ?? []} />
    </div></div>
  );
}
