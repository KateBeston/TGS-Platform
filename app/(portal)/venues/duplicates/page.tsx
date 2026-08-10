import Link from 'next/link';
import { duplicatePairs } from '@/app/actions/duplicates';
import { createClient } from '@/lib/supabase/server';
import DuplicateReview from '@/components/DuplicateReview';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export default async function DuplicatesPage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? 'Open';
  const supabase = await createClient();

  const [pairs, { data: counts }] = await Promise.all([
    duplicatePairs(status),
    supabase.from('venue_duplicates').select('status'),
  ]);

  const byStatus: Record<string, number> = {};
  (counts ?? []).forEach((r: any) => {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  });

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> · Possible duplicates
      </div>
      <DuplicateReview pairs={pairs} counts={byStatus} status={status} />
    </div></div>
  );
}
