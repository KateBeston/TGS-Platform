import Link from 'next/link';
import { docs, docsNeedingReview } from '@/app/actions/internalDocs';
import DocsIndex from '@/components/DocsIndex';

export const dynamic = 'force-dynamic';

export default async function DocsPage({
  searchParams,
}: { searchParams: Promise<{ category?: string }> }) {
  const sp = await searchParams;
  const [list, stale] = await Promise.all([
    docs(sp.category), docsNeedingReview(),
  ]);
  return (
    <div className="content"><div className="wrap">
      <DocsIndex docs={list} stale={stale} category={sp.category ?? 'all'} />
    </div></div>
  );
}
