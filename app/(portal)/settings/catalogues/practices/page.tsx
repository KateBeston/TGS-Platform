import Link from 'next/link';
import { practiceCandidates, taxonomy } from '@/app/actions/practiceCandidates';
import { createClient } from '@/lib/supabase/server';
import PracticeReview from '@/components/PracticeReview';

export const dynamic = 'force-dynamic';

export default async function PracticesPage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? 'Pending';
  const supabase = await createClient();

  const [rows, { practices, categories }, { data: counts }, { data: flagTypes }] =
    await Promise.all([
      practiceCandidates(status),
      taxonomy(),
      supabase.from('practice_candidates').select('status'),
      supabase.from('practice_flag_types').select('*').order('display_order'),
    ]);

  const byStatus: Record<string, number> = {};
  (counts ?? []).forEach((r: any) => {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  });

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/settings">Catalogues</Link> · Practices to review
      </div>
      <PracticeReview
        rows={rows} practices={practices} categories={categories}
        counts={byStatus} status={status}
        flagTypes={flagTypes ?? []}
      />
    </div></div>
  );
}
