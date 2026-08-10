import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Donut from '@/components/Donut';
import BarList from '@/components/BarList';

export const dynamic = 'force-dynamic';

function tally(rows: any[], key: string, fallback = 'Not recorded') {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (r[key] ?? '').toString().trim() || fallback;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m, ([label, value]) => ({ label, value }));
}

export default async function AcquisitionPage() {
  const supabase = await createClient();

  const [{ data: origins }, { count: subscribers }, { count: channels }] = await Promise.all([
    supabase.from('lead_origins').select('*').limit(5000),
    supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }),
    supabase.from('lead_channels').select('*', { count: 'exact', head: true }),
  ]);

  const rows = origins ?? [];
  const selfReported = rows.filter((r: any) => r.heard_about_us);
  const tracked = rows.filter((r: any) => !r.heard_about_us && r.first_utm_source);

  return (
    <>
      <div className="note">
        <strong>Two things feed this tab, and only one is connected.</strong></div>

      <div className="stats">
        <div className="stat">
          <div className={`v ${!rows.length ? 'zero' : ''}`}>{rows.length}</div>
          <div className="l">Leads captured</div>
        </div>
        <div className="stat">
          <div className={`v ${!selfReported.length ? 'zero' : ''}`}>{selfReported.length}</div>
          <div className="l">Told us how</div>
        </div>
        <div className="stat">
          <div className={`v ${!subscribers ? 'zero' : ''}`}>{subscribers ?? 0}</div>
          <div className="l">Subscribers</div>
        </div>
        <div className="stat">
          <div className="v">{channels ?? 0}</div>
          <div className="l">Channels defined</div>
        </div>
      </div>

      <div className="sect">
        <h3>How they heard about us</h3>
        <Donut slices={tally(selfReported, 'heard_about_us')}
               empty="Nothing self-reported yet. Fills once the platform form posts to the portal." />
      </div>

      <div className="sect">
        <h3>Tracked source</h3>
        <Donut slices={tally(tracked, 'first_utm_source')}
               empty="No UTM data yet. Needs the capture script on the platform site." />
      </div>

      <div className="sect">
        <h3>Where leads are from</h3>
        <BarList rows={tally(rows.filter((r: any) => r.lead_country_name), 'lead_country_name')}
                 unit="leads" empty="No location data yet." />
      </div>

      <div className="sect">
        <h3>Search performance</h3>
        <div className="note" style={{ marginBottom: 0 }}>
          <strong>Not connected.</strong> Google Search Console has the useful half of this —
          queries, impressions, clicks and average position per URL — and it is unaffected by the
          tag problem above.</div>
      </div>

      <div style={{ marginTop: 'var(--s5)' }}>
        <Link className="btn quiet" href="/marketing/attribution">Full attribution detail</Link>
      </div>
    </>
  );
}
