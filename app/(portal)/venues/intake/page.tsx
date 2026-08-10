import Link from 'next/link';
import { intakeHistory } from '@/app/actions/venueIntake';
import { createClient } from '@/lib/supabase/server';
import IntakeHistory from '@/components/IntakeHistory';

export const dynamic = 'force-dynamic';

export default async function IntakePage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? 'all';
  const supabase = await createClient();

  const [rows, { data: counts }] = await Promise.all([
    intakeHistory(status),
    supabase.from('venue_intake_drafts').select('status,cost_usd'),
  ]);

  const byStatus: Record<string, number> = {};
  let spent = 0;
  (counts ?? []).forEach((r: any) => {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    spent += Number(r.cost_usd ?? 0);
  });

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> · Read from a website
      </div>
      <IntakeHistory rows={rows} counts={byStatus} spent={spent} status={status} />
    </div></div>
  );
}
