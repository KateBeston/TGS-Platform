import type { Metadata } from 'next';
import Link from 'next/link';
import { categories } from '@/lib/experiences';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wellness experiences',
  description:
    'Every modality and tradition on The Global Sanctum — thermal bathing to '
    + 'sound, yoga to shamanic practice. Find venues by what actually happens there.',
  alternates: { canonical: '/wellness-experiences' },
};

/* The index of every category.
 *
 * The mockup has this as an accordion. Built as links rather than
 * toggles, because the audit is explicit that opening a category should
 * change the URL — a state that only exists in the browser cannot be
 * sent to anybody, cannot be indexed, and does not survive a refresh.
 *
 * Every category is listed, including those with nothing in them yet. A
 * list that changes shape as venues arrive is harder to trust than one
 * that is honest about being early. */

export default async function ExperiencesPage() {
  const supabase = await createClient();
  const [cats, { data: allPractices }] = await Promise.all([
    categories(),
    supabase.from('experience_practices')
      .select('name,slug,category_slug,venue_count')
      .order('venue_count', { ascending: false }),
  ]);

  const byCategory = new Map<string, any[]>();
  for (const p of (allPractices ?? []) as any[]) {
    const list = byCategory.get(p.category_slug) ?? [];
    list.push(p);
    byCategory.set(p.category_slug, list);
  }

  const withVenues = cats.filter((c) => c.venue_count > 0);
  const rest = cats.filter((c) => c.venue_count === 0);

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="eyebrow">Wellness experiences</div>
          <h1>Find a venue by what happens there</h1>
          <p className="page-sub">
            Every modality and tradition in our collection, from thermal bathing to
            shamanic practice. Choose one and see where it is offered.
          </p>
        </div>
      </section>

      <div className="wrap">
        <div className="cat-list">
          {withVenues.map((c, i) => {
            const practices = (byCategory.get(c.slug) ?? [])
              .filter((p: any) => p.venue_count > 0);
            return (
              <div key={c.id} className="cat-item">
                <Link href={`/wellness-experiences/${c.slug}`} className="cat-header">
                  <span className="cat-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="cat-name">
                    {c.name}
                    {c.description && <span className="cat-desc">{c.description}</span>}
                  </span>
                  <span className="cat-count">
                    {c.venue_count} venue{c.venue_count === 1 ? '' : 's'}
                  </span>
                  <span className="cat-arrow" aria-hidden="true">&rarr;</span>
                </Link>

                {!!practices.length && (
                  <div className="cat-practices">
                    {practices.slice(0, 8).map((p: any) => (
                      <Link key={p.slug}
                        href={`/wellness-experiences/${c.slug}/${p.slug}`}
                        className="cat-filter-pill">
                        {p.name}<span className="pill-n">{p.venue_count}</span>
                      </Link>
                    ))}
                    {practices.length > 8 && (
                      <Link href={`/wellness-experiences/${c.slug}`}
                        className="cat-filter-pill quiet">
                        and {practices.length - 8} more
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!!rest.length && (
          <section className="cat-empty">
            <h2>Also in the collection</h2>
            <p className="muted">
              Recorded and being sought. Nothing listed under these yet.
            </p>
            <div className="cat-practices">
              {rest.map((c) => (
                <Link key={c.id} href={`/wellness-experiences/${c.slug}`}
                  className="cat-filter-pill quiet">{c.name}</Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
