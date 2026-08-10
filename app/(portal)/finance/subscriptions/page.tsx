import Link from 'next/link';
import {
  owing, subscriptionSummary, subscriptions, tiers,
} from '@/app/actions/commission';
import SubscriptionsAndCommission from '@/components/SubscriptionsAndCommission';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const [tierList, subs, due, summary] = await Promise.all([
    tiers(), subscriptions(), owing(), subscriptionSummary(),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/finance">Finance</Link> · Subscriptions &amp; commission
      </div>
      <SubscriptionsAndCommission
        tiers={tierList} subscriptions={subs} owing={due} summary={summary}
      />
    </div></div>
  );
}
