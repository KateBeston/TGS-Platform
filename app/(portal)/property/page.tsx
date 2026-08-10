import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PropertyOverview from '@/components/PropertyOverview';

export const dynamic = 'force-dynamic';

export default async function PropertyPage() {
  const supabase = await createClient();

  const [{ count: benchmarks }, { count: comparables }, { count: valuations },
         { data: usages }] = await Promise.all([
    supabase.from('space_revenue_benchmarks').select('*', { count: 'exact', head: true }),
    supabase.from('property_comparables').select('*', { count: 'exact', head: true }),
    supabase.from('property_valuations').select('*', { count: 'exact', head: true }),
    supabase.from('space_usages').select('*').order('sqm_per_person', { ascending: false }),
  ]);

  return (
    <div className="content"><div className="wrap">
      <PropertyOverview
        usages={usages ?? []}
        counts={{
          benchmarks: benchmarks ?? 0,
          comparables: comparables ?? 0,
          valuations: valuations ?? 0,
        }}
      />
    </div></div>
  );
}
