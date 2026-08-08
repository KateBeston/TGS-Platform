import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import EditFilters from '@/components/EditFilters';
import EditMore from '@/components/EditMore';
import { readingMinutes } from '@/lib/portable-text';
import {
  articles, authors, categories, categoryName, heroUrl, type Article,
} from '@/lib/sanity';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'The Wellness Edit',
  description:
    'Considered perspectives on the spaces, practices and philosophies shaping '
    + 'how we heal, travel and live with intention.',
  alternates: { canonical: '/the-wellness-edit' },
};

/* The Wellness Edit index.
 *
 * Structure taken from the live page: a lead article with its own call
 * to action, a search panel, section pills, a three-across grid with
 * read times, and load more.
 *
 * Two departures, both deliberate. The section pills are the sections
 * articles actually carry — the live page offers eleven themes no
 * article has, so every one returns nothing, and a filter that cannot
 * match teaches somebody the collection is empty. And every article is
 * server-rendered with the overflow hidden by CSS rather than fetched on
 * click, so a crawler reads all of them.
 */

const PER_PAGE = 9;

function minutesOf(a: Article) {
  return readingMinutes(a.body ?? null);
}

function when(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-AU',
    { month: 'long', year: 'numeric' });
}

export default async function WellnessEdit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [all, cats, people] = await Promise.all([
    articles(60), categories(), authors(),
  ]);

  let shown = all;

  if (sp.category) shown = shown.filter((a) => a.category === sp.category);
  if (sp.author) shown = shown.filter((a) => a.author === sp.author);

  if (sp.within) {
    const cutoff = Date.now() - Number(sp.within) * 86_400_000;
    shown = shown.filter((a) =>
      a.publishedAt && new Date(a.publishedAt).getTime() >= cutoff);
  }

  if (sp.sort === 'oldest') {
    shown = [...shown].reverse();
  }

  const filtered = !!(sp.category || sp.author || sp.within || sp.sort);
  const [lead, ...rest] = filtered ? [null, ...shown] : shown;
  const grid = (rest as Article[]).filter(Boolean);

  return (
    <>
      <section className="edit-hero">
        <div className="wrap">
          <div className="eyebrow">The Global Sanctum presents</div>
          <h1>The Wellness Edit</h1>
          <p className="edit-hero-sub">
            Considered perspectives on the spaces, practices and philosophies
            shaping how we heal, travel and live with intention.
          </p>
        </div>
      </section>

      {!all.length ? (
        <div className="wrap">
          <div className="empty">
            <h2>Nothing published yet</h2>
            <p>
              The Wellness Edit is being written. Subscribe below and the first
              pieces will find you.
            </p>
          </div>
        </div>
      ) : (
        <>
          {lead && (
            <div className="wrap">
              <Link href={`/the-wellness-edit/${lead.slug}`} className="edit-lead">
                {heroUrl(lead, 1400, 900) && (
                  <div className="edit-lead-image">
                    <img src={heroUrl(lead, 1400, 900)!}
                      alt={lead.heroImage?.alt ?? ''} />
                  </div>
                )}
                <div className="edit-lead-body">
                  {lead.category && (
                    <div className="edit-card-cat">{categoryName(lead.category)}</div>
                  )}
                  <h2 className="edit-lead-title">{lead.title}</h2>
                  {lead.excerpt && <p className="edit-lead-excerpt">{lead.excerpt}</p>}
                  <div className="edit-meta">
                    {when(lead.publishedAt) && <span>{when(lead.publishedAt)}</span>}
                    {minutesOf(lead) && <span>{minutesOf(lead)} min read</span>}
                  </div>
                  <span className="edit-lead-cta">Read the article &rarr;</span>
                </div>
              </Link>
            </div>
          )}

          <div className="wrap">
            <Suspense fallback={<div className="edit-search" />}>
              <EditFilters categories={cats} authors={people}
                categoryName={(c) => categoryName(c) ?? c} />
            </Suspense>

            <div className="edit-themes">
              <div className="edit-themes-label">Browse by section</div>
              <div className="cat-filter-bar" style={{ border: 0, paddingBottom: 0 }}>
                <Link href="/the-wellness-edit"
                  className={`cat-filter-pill ${!sp.category ? 'is-on' : ''}`}>
                  All
                </Link>
                {cats.map((c) => (
                  <Link key={c} href={`/the-wellness-edit?category=${encodeURIComponent(c)}`}
                    className={`cat-filter-pill ${sp.category === c ? 'is-on' : ''}`}>
                    {categoryName(c)}
                  </Link>
                ))}
              </div>
            </div>

            {!grid.length ? (
              <div className="empty">
                <h2>Nothing matches that</h2>
                <Link className="btn-solid" href="/the-wellness-edit">
                  See everything
                </Link>
              </div>
            ) : (
              <>
                <div className="edit-grid">
                  {grid.map((a, i) => (
                    <Link key={a._id} href={`/the-wellness-edit/${a.slug}`}
                      className={`edit-card ${i >= PER_PAGE ? 'is-hidden' : ''}`}>
                      {heroUrl(a, 720, 480) && (
                        <div className="edit-card-image">
                          <img src={heroUrl(a, 720, 480)!}
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
                          {when(a.publishedAt) && <span>{when(a.publishedAt)}</span>}
                          {minutesOf(a) && <span>{minutesOf(a)} min read</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <EditMore hidden={Math.max(0, grid.length - PER_PAGE)} />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
