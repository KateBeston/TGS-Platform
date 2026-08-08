import type { Metadata } from 'next';
import Link from 'next/link';
import { articles, categories, categoryName, heroUrl } from '@/lib/sanity';

// Editorial changes rarely. Five minutes is close enough to live for a
// reader and removes a query from most page loads.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'The Wellness Edit',
  description:
    'Writing on the spaces where wellness happens — design, psychology, '
    + 'tradition and the places themselves.',
  alternates: { canonical: '/the-wellness-edit' },
};

/* The Wellness Edit index.
 *
 * Reads from Sanity rather than Supabase — the only part of the site
 * that does. Long-form editorial with pull quotes and hero images is
 * what a rich-text CMS is for, and there is real content in there
 * already.
 *
 * The first piece takes the full width. An editorial index where
 * everything is the same size has no editorial opinion in it. */

export default async function WellnessEdit({
  searchParams,
}: { searchParams: Promise<{ category?: string }> }) {
  const sp = await searchParams;
  const [all, cats] = await Promise.all([articles(24), categories()]);

  const shown = sp.category
    ? all.filter((a) => a.category === sp.category)
    : all;

  const [lead, ...rest] = shown;

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="eyebrow">The Wellness Edit</div>
          <h1>Words on wellness, places and practice</h1>
          <p className="page-sub">
            Writing on the spaces where wellness happens &mdash; how they are
            designed, why they work, and what they ask of us.
          </p>
        </div>
      </section>

      <div className="wrap">
        {!all.length ? (
          <div className="empty">
            <h2>Nothing published yet</h2>
            <p>
              The Wellness Edit is being written. Subscribe to the Sanctum Journal
              below and the first pieces will find you.
            </p>
          </div>
        ) : (
          <>
            {cats.length > 1 && (
              <div className="cat-filter-bar">
                <Link href="/the-wellness-edit"
                  className={`cat-filter-pill ${!sp.category ? 'is-on' : ''}`}>
                  Everything
                </Link>
                {cats.map((c) => (
                  <Link key={c} href={`/the-wellness-edit?category=${c}`}
                    className={`cat-filter-pill ${sp.category === c ? 'is-on' : ''}`}>
                    {categoryName(c)}
                  </Link>
                ))}
              </div>
            )}

            {lead && (
              <Link href={`/the-wellness-edit/${lead.slug}`} className="edit-lead">
                {heroUrl(lead, 1400, 780) && (
                  <div className="edit-lead-image">
                    <img src={heroUrl(lead, 1400, 780)!}
                      alt={lead.heroImage?.alt ?? ''} />
                  </div>
                )}
                <div className="edit-lead-body">
                  {lead.category && (
                    <div className="feature-eyebrow">{categoryName(lead.category)}</div>
                  )}
                  <h2 className="edit-lead-title">{lead.title}</h2>
                  {lead.excerpt && <p className="edit-lead-excerpt">{lead.excerpt}</p>}
                  <div className="edit-meta">
                    {lead.author && <span>{lead.author}</span>}
                    {lead.publishedAt && (
                      <span>{new Date(lead.publishedAt).toLocaleDateString('en-AU',
                        { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    )}
                  </div>
                </div>
              </Link>
            )}

            {!!rest.length && (
              <div className="edit-grid">
                {rest.map((a) => (
                  <Link key={a._id} href={`/the-wellness-edit/${a.slug}`}
                    className="edit-card">
                    {heroUrl(a, 640, 420) && (
                      <div className="edit-card-image">
                        <img src={heroUrl(a, 640, 420)!}
                          alt={a.heroImage?.alt ?? ''} loading="lazy" />
                      </div>
                    )}
                    <div className="edit-card-body">
                      {a.category && (
                        <div className="edit-card-cat">{categoryName(a.category)}</div>
                      )}
                      <h3 className="edit-card-title">{a.title}</h3>
                      {a.excerpt && <p className="edit-card-excerpt">{a.excerpt}</p>}
                      <div className="edit-meta">
                        {a.publishedAt && (
                          <span>{new Date(a.publishedAt).toLocaleDateString('en-AU',
                            { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!shown.length && (
              <div className="empty">
                <h2>Nothing under {categoryName(sp.category ?? '')} yet</h2>
                <Link className="btn-solid" href="/the-wellness-edit">
                  See everything
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
