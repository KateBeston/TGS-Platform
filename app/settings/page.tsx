import type { Metadata } from 'next';
import Link from 'next/link';
import { settings, groupByCategory } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Retreat venues by setting — The Global Sanctum',
  description: 'From tranquil coastlines to urban escapes, explore retreats and wellness venues by their setting.',
};

export default async function Page() {
  const all = await settings();
  const groups = groupByCategory(all);
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb"><Link href="/venues">Venues</Link></div>
          <h1 style={{ marginTop: 'var(--s4)' }}>Explore by Setting</h1>
          <p className="page-lead">From tranquil coastlines to urban escapes</p>
          <p className="cat-desc">Every setting we curate, grouped by the water, landscape, climate and character that shape a stay.</p>
        </div>
      </section>
      <div className="wrap">
        {groups.map((g) => (
          <section key={g.category} className="set-group">
            <h2 className="set-group-h">{g.category}</h2>
            <div className="set-grid">
              {g.items.map((s) => (
                <Link key={s.id} href={`/settings/${s.slug}`} className="set-card">
                  <span className="set-card-name">{s.name}</span>
                  {s.tagline ? <span className="set-card-tag">{s.tagline}</span> : null}
                  <span className="set-card-go">Explore &rarr;</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
