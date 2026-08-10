import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HARVEST_FIELDS } from '@/lib/harvestFields';
import HarvestFieldMap from '@/components/HarvestFieldMap';

export const dynamic = 'force-dynamic';

export default async function HarvestFieldsPage() {
  const supabase = await createClient();

  // Cross-checked against the live schema, so a renamed or missing column
  // shows as a broken mapping rather than failing quietly on apply.
  const { data: columns } = await supabase.rpc('venue_columns');

  const [{ data: proposals }, { data: gaps }] = await Promise.all([
    supabase.from('extraction_proposals').select('target_column,status').limit(20000),
    supabase.from('extraction_gaps').select('target_column,gap_reason').limit(20000),
  ]);

  const proposedCount = new Map<string, number>();
  const appliedCount = new Map<string, number>();
  (proposals ?? []).forEach((p: any) => {
    proposedCount.set(p.target_column, (proposedCount.get(p.target_column) ?? 0) + 1);
    if (p.status === 'Accepted') {
      appliedCount.set(p.target_column, (appliedCount.get(p.target_column) ?? 0) + 1);
    }
  });

  const silentCount = new Map<string, number>();
  (gaps ?? []).forEach((g: any) => {
    if (g.gap_reason === 'Not stated') {
      silentCount.set(g.target_column, (silentCount.get(g.target_column) ?? 0) + 1);
    }
  });

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> ·{' '}
        <Link href="/venues/harvest">Harvest</Link> · Fields
      </div>
      <HarvestFieldMap
        fields={HARVEST_FIELDS}
        schema={(columns ?? []) as any[]}
        proposed={Object.fromEntries(proposedCount)}
        applied={Object.fromEntries(appliedCount)}
        silent={Object.fromEntries(silentCount)}
      />
    </div></div>
  );
}
