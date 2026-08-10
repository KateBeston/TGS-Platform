import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import HarvestQueue from '@/components/HarvestQueue';

export const dynamic = 'force-dynamic';

export default async function HarvestPage() {
  const supabase = await createClient();

  const [{ count: withUrl }, { count: done }, { data: runs }, { data: proposals },
         { count: aiRemaining }, { data: spend }] =
    await Promise.all([
      supabase.from('venues').select('*', { count: 'exact', head: true })
        .not('website_url', 'is', null),
      supabase.from('venues').select('*', { count: 'exact', head: true })
        .not('last_extracted_at', 'is', null),
      supabase.from('extraction_runs')
        .select('*, venues(id,venue_name)')
        .order('started_at', { ascending: false }).limit(30),
      supabase.from('extraction_proposals')
        .select('*').in('status', ['Proposed', 'Conflict'])
        .order('run_id', { ascending: false }).limit(400),
      supabase.from('venues').select('*', { count: 'exact', head: true })
        .not('website_url', 'is', null).is('last_ai_extracted_at', null),
      supabase.from('ai_extraction_spend').select('*').maybeSingle(),
    ]);

  const pending = (proposals ?? []).length;

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> · Website harvest
      </div>

      <div className="ph">
        <div>
          <h2>Website harvest</h2>
          <div className="ph-sub">
            Reads what a venue's own site states about itself in machine-readable form
          </div>
        </div>
      </div>

      <div className="note">
        <strong>Nothing here is guessed.</strong> This pass reads schema.org markup, Open Graph
        tags and explicit contact links — values a page publishes about itself.</div>

      <div className="stats">
        <div className="stat">
          <div className="v">{(withUrl ?? 0).toLocaleString('en-AU')}</div>
          <div className="l">Venues with a website</div>
        </div>
        <div className="stat">
          <div className={`v ${!done ? 'zero' : ''}`}>{(done ?? 0).toLocaleString('en-AU')}</div>
          <div className="l">Sites read</div>
        </div>
        <div className="stat">
          <div className={`v ${!pending ? 'zero' : ''}`}>{pending.toLocaleString('en-AU')}</div>
          <div className="l">Awaiting review</div>
        </div>
        <div className="stat">
          <div className="v">{((withUrl ?? 0) - (done ?? 0)).toLocaleString('en-AU')}</div>
          <div className="l">Still to read</div>
        </div>
      </div>

      <HarvestQueue runs={runs ?? []} proposals={proposals ?? []}
                    remaining={(withUrl ?? 0) - (done ?? 0)}
                    aiRemaining={aiRemaining ?? 0}
                    spend={spend ?? null} />
    </div></div>
  );
}
