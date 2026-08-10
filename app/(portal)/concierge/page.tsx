import { enquiriesIn, pipeline } from '@/app/actions/concierge';
import ConciergePipeline from '@/components/ConciergePipeline';

export const dynamic = 'force-dynamic';

export default async function ConciergePage({
  searchParams,
}: { searchParams: Promise<{ status?: string; kind?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? 'Searching';
  const kind = sp.kind ?? null;

  const [counts, rows] = await Promise.all([
    pipeline(),
    enquiriesIn(status, kind ?? undefined),
  ]);

  return (
    <div className="content"><div className="wrap">
      <ConciergePipeline counts={counts} rows={rows} active={status} kind={kind} />
    </div></div>
  );
}
