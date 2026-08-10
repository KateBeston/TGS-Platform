import Link from 'next/link';
import { searchOptions } from '@/app/actions/search';
import { listSavedSearches } from '@/app/actions/search';
import AdvancedSearch from '@/components/AdvancedSearch';

export const dynamic = 'force-dynamic';

export default async function SearchPage() {
  const [options, saved] = await Promise.all([searchOptions(), listSavedSearches()]);
  return (
    <>
      <div style={{ padding: 'var(--s6) var(--s5) 0' }}>
        <div className="wrap">
          <div className="tb-crumb">
            <Link href="/concierge">Concierge</Link> · Venue search
          </div>
        </div>
      </div>
      <AdvancedSearch options={options} saved={saved} />
    </>
  );
}
