import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ExperienceResults from '@/components/ExperienceResults';
import {
  categoryBySlug, practiceBySlug, practicesIn, practicesOfVenues, venuesFor,
} from '@/lib/experiences';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ category: string; practice: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category, practice } = await params;
  const p = await practiceBySlug(category, practice);
  if (!p) return { title: 'Not found' };

  // The page most likely to be found by somebody searching for the
  // practice by name, so the title leads with it.
  return {
    title: `${p.name} — venues and retreats`,
    description: p.description
      ?? `Venues offering ${p.name.toLowerCase()}, curated from around the world.`,
    alternates: { canonical: `/wellness-experiences/${category}/${p.slug}` },
  };
}

export default async function PracticePage({ params }: Params) {
  const { category, practice } = await params;
  const [c, p] = await Promise.all([
    categoryBySlug(category), practiceBySlug(category, practice),
  ]);
  if (!c || !p) notFound();

  const [siblings, venues] = await Promise.all([
    practicesIn(c.id),
    venuesFor({ practiceId: p.id }),
  ]);
  const practiceMap = await practicesOfVenues(venues.map((v) => v.id));

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb">
            <Link href="/wellness-experiences">Wellness experiences</Link>
            {' · '}
            <Link href={`/wellness-experiences/${c.slug}`}>{c.name}</Link>
          </div>
          <h1 style={{ marginTop: 'var(--s4)' }}>{p.name}</h1>
          {p.description && <p className="page-sub">{p.description}</p>}
          <p className="page-sub" style={{ fontSize: 15, marginTop: 'var(--s3)' }}>
            {p.venue_count} venue{p.venue_count === 1 ? '' : 's'} in the collection
          </p>
        </div>
      </section>

      <div className="wrap">
        <div className="cat-filter-bar">
          <Link href={`/wellness-experiences/${c.slug}`} className="cat-filter-pill">
            All of {c.name}
          </Link>
          {siblings.map((s) => (
            s.id === p.id ? (
              <span key={s.id} className="cat-filter-pill is-on">{s.name}</span>
            ) : s.venue_count > 0 ? (
              <Link key={s.id} href={`/wellness-experiences/${c.slug}/${s.slug}`}
                className="cat-filter-pill">
                {s.name}<span className="pill-n">{s.venue_count}</span>
              </Link>
            ) : (
              <span key={s.id} className="cat-filter-pill quiet">{s.name}</span>
            )
          ))}
        </div>

        <ExperienceResults venues={venues} practices={practiceMap} highlight={p.name} />
      </div>
    </>
  );
}
