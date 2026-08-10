import Link from 'next/link';
import { coverageSummary } from '@/app/actions/aiHarvest';
import CoverageReport from '@/components/CoverageReport';

export const dynamic = 'force-dynamic';

export default async function CoveragePage() {
  const summary = await coverageSummary();
  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> ·{' '}
        <Link href="/venues/harvest">Harvest</Link> · What the web does not say
      </div>
      <CoverageReport summary={summary} />
    </div></div>
  );
}
