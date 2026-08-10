import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const supabase = await createClient();

  const [{ count: leads }, { count: contacts }, { count: subscribers }, { count: channels }] =
    await Promise.all([
      supabase.from('venues').select('*', { count: 'exact', head: true })
        .not('lead_received_at', 'is', null),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }),
      supabase.from('lead_channels').select('*', { count: 'exact', head: true }),
    ]);

  const stat = (v: number | null) => ({ value: v ?? 0, zero: !v });
  const cells = [
    { label: 'Venue leads', ...stat(leads) },
    { label: 'Contacts', ...stat(contacts) },
    { label: 'Subscribers', ...stat(subscribers) },
    { label: 'Channels tracked', ...stat(channels) },
  ];

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Marketing</h2>
          <div className="ph-sub">Attribution, channels and audience</div>
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
        <div className="band-label"><span className="bl">Reporting</span></div>
        <div className="tiles">
          <Link className="tile" href="/marketing/social"
                style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>Social</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
              Four accounts, what has been posted, and what came back
            </div>
          </Link>
          <Link className="tile" href="/marketing/attribution"
                style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>Lead attribution</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
              Where leads come from, self-reported and tracked
            </div>
          </Link>
          <span className="tile off" style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>Campaigns</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>Not yet built</div>
          </span>
          <span className="tile off" style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>Content calendar</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>Not yet built</div>
          </span>
        </div>
      </div>
    </div></div>
  );
}
