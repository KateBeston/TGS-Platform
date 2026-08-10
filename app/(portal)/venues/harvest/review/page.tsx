import Link from 'next/link';
import { proposalGroups } from '@/app/actions/harvest';
import BulkReview from '@/components/BulkReview';

export const dynamic = 'force-dynamic';

export default async function BulkReviewPage() {
  const groups = await proposalGroups();
  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> ·{' '}
        <Link href="/venues/harvest">Harvest</Link> · Review by field
      </div>
      <BulkReview groups={groups} />
    </div></div>
  );
}
