import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ExperienceResults from '@/components/ExperienceResults';
import { categories, categoryBySlug, practicesIn, practicesOfVenues, venuesFor } from '@/lib/experiences';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category } = await params;
  const c = await categoryBySlug(category);
  if (!c) return { title: 'Not found' };

  return {
    title: `${c.name} venues and retreats`,
    description: c.description
      ?? `Venues offering ${c.name.toLowerCase()}, curated from around the world.`,
    alternates: { canonical: `/wellness-experiences/${c.slug}` },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { category } = await params;
  const c = await categoryBySlug(category);
  if (!c) notFound();

  const [practices, venues] = await Promise.all([
    practicesIn(c.id),
    venuesFor({ categoryId: c.id }),
  ]);
  const practiceMap = await practicesOfVenues(venues.map((v) => v.id));

  // Sibling categories, so the page has somewhere onward to go — the
  // category-level equivalent of "related practices" on a practice page.
  const allCats = await categories();
  const related = (allCats as any[])
    .filter((x) => x.in_wellness && x.slug !== c.slug)
    .slice(0, 6);

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb">
            <Link href="/wellness-experiences">Wellness experiences</Link>
          </div>
          <h1 style={{ marginTop: 'var(--s4)' }}>{c.name}</h1>
          {c.description && <p className="page-sub">{c.description}</p>}
          <p className="page-sub" style={{ fontSize: 15, marginTop: 'var(--s3)' }}>
            {c.venue_count} venue{c.venue_count === 1 ? '' : 's'} ·{' '}
            {practices.length} practice{practices.length === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      <div className="wrap cat-body">
        {/* Every practice, including those with nothing yet. A list that
            changes shape as venues arrive is harder to trust than one
            that is honest about being early. */}
        <div className="cat-filter-bar">
          <span className="cat-filter-pill is-on">All of {c.name}</span>
          {practices.map((p) => (
            p.venue_count > 0 ? (
              <Link key={p.id} href={`/wellness-experiences/${c.slug}/${p.slug}`}
                className="cat-filter-pill">
                {p.name}<span className="pill-n">{p.venue_count}</span>
              </Link>
            ) : (
              <span key={p.id} className="cat-filter-pill quiet">{p.name}</span>
            )
          ))}
        </div>

        <ExperienceResults venues={venues} practices={practiceMap} />
      </div>

      {related.length > 0 && (
        <section className="cat-related">
          <div className="wrap">
            <h3>More to explore</h3>
            <div className="cat-pills">
              {related.map((r) => (
                <Link key={r.id} href={`/wellness-experiences/${r.slug}`}>{r.name}</Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
