import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ComparablesEditor from '@/components/ComparablesEditor';

export const dynamic = 'force-dynamic';

export default async function ComparablesPage() {
  const supabase = await createClient();
  const [{ data: rows }, { data: countries }] = await Promise.all([
    supabase.from('property_comparables').select('*, countries(name)')
      .order('event_date', { ascending: false, nullsFirst: false }).limit(200),
    supabase.from('countries').select('id,name').order('name'),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/property">Property</Link> · Comparables
      </div>
      <ComparablesEditor rows={rows ?? []} countries={countries ?? []} />
    </div></div>
  );
}
