import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import BenchmarkEditor from '@/components/BenchmarkEditor';

export const dynamic = 'force-dynamic';

export default async function BenchmarksPage() {
  const supabase = await createClient();

  const [{ data: usages }, { data: benchmarks }, { data: countries }] = await Promise.all([
    supabase.from('space_usages').select('*').order('category').order('display_order'),
    supabase.from('space_revenue_benchmarks')
      .select('*, space_usages(name,category,sqm_per_person), countries(name)')
      .order('usage_id'),
    supabase.from('countries').select('id,name')
      .in('id', (await supabase.from('venues').select('country_id')
        .not('country_id', 'is', null).limit(6000)).data
        ?.map((v: any) => v.country_id).filter(Boolean) ?? [])
      .order('name'),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/property">Property</Link> · Rate benchmarks
      </div>
      <BenchmarkEditor
        usages={usages ?? []}
        benchmarks={benchmarks ?? []}
        countries={countries ?? []}
      />
    </div></div>
  );
}
