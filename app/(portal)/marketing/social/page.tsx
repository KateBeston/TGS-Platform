import Link from 'next/link';
import {
  accounts, posts, snapshots, venuesNotFeatured,
} from '@/app/actions/social';
import SocialScreen from '@/components/SocialScreen';

export const dynamic = 'force-dynamic';

export default async function SocialPage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const [list, feed, history, unfeatured] = await Promise.all([
    accounts(), posts(sp.status), snapshots(), venuesNotFeatured(),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/marketing">Marketing</Link> · Social
      </div>
      <SocialScreen
        accounts={list} posts={feed} snapshots={history}
        unfeatured={unfeatured} status={sp.status ?? 'all'}
      />
    </div></div>
  );
}
