import Link from 'next/link';
import { candidates, catalogueItems } from '@/app/actions/facilityCandidates';
import { createClient } from '@/lib/supabase/server';
import CandidateReview from '@/components/CandidateReview';

export const dynamic = 'force-dynamic';

export default async function CandidatesPage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? 'Pending';
  const supabase = await createClient();

  const [rows, items, { data: categories }, { data: counts }] = await Promise.all([
    candidates(status),
    catalogueItems(),
    supabase.from('facility_categories').select('id,name').order('display_order'),
    supabase.from('facility_candidates').select('status'),
  ]);

  const byStatus: Record<string, number> = {};
  (counts ?? []).forEach((r: any) => {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  });

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/settings/catalogues">Catalogues</Link> · Unrecognised amenities
      </div>
      <CandidateReview
        rows={rows} items={items} categories={categories ?? []}
        counts={byStatus} status={status}
      />
    </div></div>
  );
}
