import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import GeocodeQueue from '@/components/GeocodeQueue';
import CoordinateProblems from '@/components/CoordinateProblems';
import { coordinateProblems } from '@/app/actions/geocode';

export const dynamic = 'force-dynamic';
// Nominatim permits roughly one request a second, so a batch of forty
// takes three quarters of a minute. The default timeout is sixty.
export const maxDuration = 120;

export default async function GeocodePage() {
  const problems = await coordinateProblems();
  const supabase = await createClient();

  const [
    { count: missing }, { count: hasAddress }, { count: verified },
    { data: checks },
  ] = await Promise.all([
    supabase.from('venues').select('*', { count: 'exact', head: true }).is('latitude', null),
    supabase.from('venues').select('*', { count: 'exact', head: true })
      .is('latitude', null).not('street_address', 'is', null),
    supabase.from('venues').select('*', { count: 'exact', head: true })
      .not('coordinates_verified_at', 'is', null),
    supabase.from('geocode_checks')
      .select('*, venues(id,venue_name,street_address,countries(name))')
      .order('checked_at', { ascending: false }).limit(60),
  ]);

  const byVerdict = (checks ?? []).reduce<Record<string, number>>((a, c: any) => {
    a[c.verdict] = (a[c.verdict] ?? 0) + 1; return a;
  }, {});

  return (
    <div className="content"><div className="wrap">
      <CoordinateProblems rows={problems} />
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> · Coordinate verification
      </div>

      <div className="ph">
        <div>
          <h2>Coordinate verification</h2>
          <div className="ph-sub">
            Each address is geocoded twice — Google and OpenStreetMap — and the results compared
          </div>
        </div>
      </div>

      <div className="note">
        <strong>Agreement between two independent sources is evidence; one source is a claim.</strong></div>

      <div className="stats">
        <div className="stat">
          <div className="v">{(hasAddress ?? 0).toLocaleString('en-AU')}</div>
          <div className="l">Ready to check</div>
        </div>
        <div className="stat">
          <div className={`v ${!verified ? 'zero' : ''}`}>{(verified ?? 0).toLocaleString('en-AU')}</div>
          <div className="l">Verified</div>
        </div>
        <div className="stat">
          <div className="v">{(missing ?? 0).toLocaleString('en-AU')}</div>
          <div className="l">No coordinates</div>
        </div>
        <div className="stat">
          <div className={`v ${!byVerdict.Disagreed ? 'zero' : ''}`}>{byVerdict.Disagreed ?? 0}</div>
          <div className="l">Need a decision</div>
        </div>
      </div>

      <GeocodeQueue checks={checks ?? []} readyCount={hasAddress ?? 0} />
    </div></div>
  );
}
