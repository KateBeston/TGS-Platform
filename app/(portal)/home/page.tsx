import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Lockup from '@/components/Lockup';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();

  const [venues, countries, listings, enquiries, legal, benchmarks] = await Promise.all([
    supabase.from('venues').select('*', { count: 'exact', head: true }),
    supabase.from('countries').select('*', { count: 'exact', head: true }),
    supabase.from('venue_listings').select('*', { count: 'exact', head: true }),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }),
    supabase.from('legal_documents').select('*', { count: 'exact', head: true }),
    supabase.from('space_revenue_benchmarks').select('*', { count: 'exact', head: true }),
  ]);

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const stat = (v: number | null) => ({ value: v ?? 0, zero: !v });
  const benchmarkCount = benchmarks.count ?? 0;

  const cells = [
    { label: 'Venues catalogued', ...stat(venues.count) },
    { label: 'Countries', ...stat(countries.count) },
    { label: 'Live listings', ...stat(listings.count) },
    { label: 'Open enquiries', ...stat(enquiries.count) },
    { label: 'Legal documents', ...stat(legal.count) },
  ];

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Dashboard</h2>
          <div className="ph-sub">{today}</div>
        </div>
      </div>

      <div className="stats">
        {cells.map((c) => (
          <div className="stat" key={c.label}>
            <div className={`v ${c.zero ? 'zero' : ''}`}>{c.value.toLocaleString('en-AU')}</div>
            <div className="l">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="band">
        <div className="band-label">
          <span className="bl">Core product</span>
        </div>
        <div className="tiles">
          <Link className="tile" href="/listings">
            <div style={{ fontFamily: 'var(--serif)', fontSize: 27, letterSpacing: '.03em' }}>
              The Global Sanctum
            </div>
            <div className="endorse">Marketplace &amp; listings</div>
            <div className="tile-meta">
              {(listings.count ?? 0).toLocaleString('en-AU')} listing records
            </div>
          </Link>
          <Link className="tile" href="/venues">
            <div style={{ fontFamily: 'var(--serif)', fontSize: 27, letterSpacing: '.03em' }}>
              Venue Records
            </div>
            <div className="endorse">Operational data</div>
            <div className="tile-meta">
              {(venues.count ?? 0).toLocaleString('en-AU')} venue records
            </div>
          </Link>
        </div>
      </div>

      <div className="band">
        <div className="band-label">
          <span className="bl">Offerings — member &amp; lifestyle</span>
        </div>
        <div className="tiles">
          <Link className="tile" href="/concierge">
            <Lockup word="Concierge" register="script" />
            <div className="endorse">by The Global Sanctum</div>
            <div className="tile-meta">Enquiries, matching and shortlists</div>
          </Link>
          <span className="tile off">
            <Lockup word="Société" register="script" />
            <div className="endorse">by The Global Sanctum</div>
            <div className="tile-meta">Inactive</div>
          </span>
        </div>
      </div>

      <div className="band">
        <div className="band-label">
          <span className="bl">Offerings — platforms &amp; professional</span>
        </div>
        <div className="tiles">
          <Link className="tile" href="/property">
            <Lockup word="Property" register="caps" />
            <div className="endorse">by The Global Sanctum</div>
            <div className="tile-meta">
              {benchmarkCount
                ? `${benchmarkCount} rate benchmark${benchmarkCount === 1 ? '' : 's'}`
                : 'Sales, management and valuation'}
            </div>
          </Link>
          <span className="tile off">
            <Lockup word="Institute" register="caps" />
            <div className="endorse">by The Global Sanctum</div>
            <div className="tile-meta">No snapshot data</div>
          </span>
          <span className="tile off">
            <Lockup word="RMS" register="caps" />
            <div className="endorse">Retreat management</div>
            <div className="tile-meta">Not deployed</div>
          </span>
          <span className="tile off">
            <Lockup word="VMS" register="caps" />
            <div className="endorse">Venue management</div>
            <div className="tile-meta">Not deployed</div>
          </span>
        </div>
      </div>

      <div className="band">
        <div className="band-label">
          <span className="bl">Offerings — editorial &amp; media</span>
        </div>
        <div className="tiles">
          <a className="tile" href="https://journal.theglobalsanctum.com"
             target="_blank" rel="noopener">
            <Lockup word="Journal" register="caps" />
            <div className="endorse">by The Global Sanctum</div>
            <div className="tile-meta">Words on wellness · monthly</div>
          </a>
          <span className="tile off">
            <Lockup word="Magazine" register="caps" />
            <div className="endorse">by The Global Sanctum</div>
            <div className="tile-meta">Long-form editorial · not started</div>
          </span>
        </div>
      </div>
    </div></div>
  );
}
