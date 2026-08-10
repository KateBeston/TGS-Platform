import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Donut from '@/components/Donut';
import BarList from '@/components/BarList';

export const dynamic = 'force-dynamic';

function tally(rows: any[], key: string, fallback = 'Not recorded') {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = (r[key] ?? '').toString().trim() || fallback;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts, ([label, value]) => ({ label, value }));
}

export default async function AttributionPage({
  searchParams,
}: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = Number(sp.days) || 90;

  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: origins }, { data: options }] = await Promise.all([
    supabase.from('lead_origins').select('*').gte('created_at', since).limit(5000),
    supabase.from('heard_about_options').select('option_key,label'),
  ]);

  const rows = origins ?? [];
  const labelFor = new Map((options ?? []).map((o: any) => [o.option_key, o.label]));

  // Self-reported wins wherever it exists — tracking only ever sees the
  // last click, and a person telling you a friend recommended them is the
  // truer answer even when they arrived via an ad.
  const selfReported = rows
    .filter((r: any) => r.heard_about_us)
    .map((r: any) => ({ ...r, heard_label: labelFor.get(r.heard_about_us) ?? r.heard_about_us }));

  const tracked = rows.filter((r: any) => !r.heard_about_us && r.first_utm_source);
  const unattributed = rows.filter((r: any) => !r.heard_about_us && !r.first_utm_source);

  const heardSlices = tally(selfReported, 'heard_label');
  const trackedSlices = tally(tracked, 'first_utm_source');
  const countrySlices = tally(rows, 'lead_country_name', 'Unknown');
  const campaignRows = tally(rows.filter((r: any) => r.first_utm_campaign), 'first_utm_campaign');
  const cityRows = tally(rows.filter((r: any) => r.lead_city), 'lead_city');
  const typeSlices = tally(rows, 'record_type');

  const RANGES = [30, 90, 180, 365];

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/marketing">Marketing</Link> · Lead attribution
      </div>

      <div className="ph">
        <div>
          <h2>Lead attribution</h2>
          <div className="ph-sub">
            {rows.length.toLocaleString('en-AU')} lead{rows.length === 1 ? '' : 's'} in the last {days} days
          </div>
        </div>
        <div className="ph-act">
          {RANGES.map((d) => (
            <Link key={d} href={`/marketing/attribution?days=${d}`}
                  className={`btn ${d === days ? '' : 'quiet'}`}>{d}d</Link>
          ))}
        </div>
      </div>

      <div className="note">
        <strong>Self-reported attribution takes precedence over tracked.</strong></div>

      <div className="stats">
        <div className="stat">
          <div className={`v ${!selfReported.length ? 'zero' : ''}`}>{selfReported.length}</div>
          <div className="l">Told us directly</div>
        </div>
        <div className="stat">
          <div className={`v ${!tracked.length ? 'zero' : ''}`}>{tracked.length}</div>
          <div className="l">Tracked only</div>
        </div>
        <div className="stat">
          <div className={`v ${!unattributed.length ? 'zero' : ''}`}>{unattributed.length}</div>
          <div className="l">Unattributed</div>
        </div>
        <div className="stat">
          <div className={`v ${!rows.length ? 'zero' : ''}`}>
            {rows.length ? Math.round((selfReported.length / rows.length) * 100) : 0}%
          </div>
          <div className="l">Answered the question</div>
        </div>
      </div>

      <div className="sect">
        <h3>How they heard about us</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>Self-reported on the form</div>
        <Donut slices={heardSlices}
               empty="Nothing self-reported yet. This fills once the platform form is live." />
      </div>

      <div className="sect">
        <h3>Tracked source</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          Where the click came from, for leads that did not answer the question
        </div>
        <Donut slices={trackedSlices}
               empty="No tracked sources yet. Needs UTM capture on the platform site." />
      </div>

      <div className="sect">
        <h3>Where leads are from</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          Approximate, from the request. Country is reliable; a VPN reports its exit node.
        </div>
        <Donut slices={countrySlices} empty="No location data yet." />
      </div>

      <div className="sect">
        <h3>Campaigns</h3>
        <BarList rows={campaignRows} unit="leads"
                 empty="No campaign parameters seen yet." />
      </div>

      <div className="sect">
        <h3>Cities</h3>
        <BarList rows={cityRows} unit="leads"
                 empty="No city data yet. Less reliable than country — treat as indicative." />
      </div>

      <div className="sect">
        <h3>Record type</h3>
        <Donut slices={typeSlices} size={160} empty="No leads yet." />
      </div>
    </div></div>
  );
}
