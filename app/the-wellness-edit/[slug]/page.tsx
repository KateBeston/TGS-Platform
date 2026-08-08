import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ShareArticle from '@/components/ShareArticle';
import PortableText, { readingMinutes } from '@/lib/portable-text';
import { article, categoryName, heroUrl, moreArticles } from '@/lib/sanity';

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const a = await article(slug);
  if (!a) return { title: 'Not found' };

  const image = heroUrl(a, 1200, 630);

  return {
    title: a.seoTitle ?? a.title,
    description: a.seoDescription ?? a.excerpt ?? undefined,
    alternates: { canonical: `/the-wellness-edit/${a.slug}` },
    openGraph: {
      type: 'article',
      title: a.seoTitle ?? a.title,
      description: a.seoDescription ?? a.excerpt ?? undefined,
      // A dedicated 1200 × 630 crop, which the audit asks for by name.
      // The upload is 5448 × 3632; served whole it breaks social preview
      // and costs more than the rest of the page put together.
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
      publishedTime: a.publishedAt ?? undefined,
      // Emitted as well as published, so a corrected piece is understood
      // as revised rather than as unchanged since publication.
      modifiedTime: a._updatedAt ?? undefined,
      authors: a.author ? [a.author] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const a = await article(slug);
  if (!a) notFound();

  const more = await moreArticles(a.slug, a.category);
  const minutes = readingMinutes(a.body);
  const hero = heroUrl(a, 1600, 900);

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title,
    description: a.seoDescription ?? a.excerpt ?? undefined,
    image: heroUrl(a, 1200, 630) ?? undefined,
    datePublished: a.publishedAt ?? undefined,
    dateModified: a._updatedAt ?? a.publishedAt ?? undefined,
    author: a.author ? { '@type': 'Organization', name: a.author } : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'The Global Sanctum',
      url: 'https://www.theglobalsanctum.com',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://www.theglobalsanctum.com/the-wellness-edit/${a.slug}`,
    },
  };

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'The Wellness Edit',
        item: 'https://www.theglobalsanctum.com/the-wellness-edit' },
      { '@type': 'ListItem', position: 2, name: a.title },
    ],
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      <article>
        <section className="page-head">
          <div className="wrap article-head">
            <div className="tb-crumb">
              <Link href="/the-wellness-edit">The Wellness Edit</Link>
              {a.category && <> · {categoryName(a.category)}</>}
            </div>
            <h1 style={{ marginTop: 'var(--s4)' }}>{a.title}</h1>
            {/* The standfirst, once. The audit found it rendering twice
                on the live article. */}
            {a.excerpt && <p className="article-standfirst">{a.excerpt}</p>}
            <div className="edit-meta">
              {a.author && <span>{a.author}</span>}
              {a.publishedAt && (
                <span>{new Date(a.publishedAt).toLocaleDateString('en-AU',
                  { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              )}
              {minutes && <span>{minutes} minute read</span>}
            </div>
          </div>
        </section>

        {hero && (
          <div className="article-hero">
            <img src={hero} alt={a.heroImage?.alt ?? ''} />
            {a.heroImage?.alt && <figcaption>{a.heroImage.alt}</figcaption>}
          </div>
        )}

        <div className="wrap">
          <div className="article-body">
            <PortableText blocks={a.body} />
          </div>

          <div className="article-foot">
            <ShareArticle title={a.title} />
            {!!a.tags?.length && (
              <div className="article-tags">
                {a.tags.map((t) => <span key={t} className="card-tag">{t}</span>)}
              </div>
            )}
          </div>
        </div>
      </article>

      {!!more.length && (
        <div className="wrap">
          <section className="article-more">
            <h2>More from The Wellness Edit</h2>
            <div className="edit-grid">
              {more.map((m) => (
                <Link key={m._id} href={`/the-wellness-edit/${m.slug}`}
                  className="edit-card">
                  {heroUrl(m, 640, 420) && (
                    <div className="edit-card-image">
                      <img src={heroUrl(m, 640, 420)!}
                        alt={m.heroImage?.alt ?? ''} loading="lazy" />
                    </div>
                  )}
                  <div className="edit-card-body">
                    {m.category && (
                      <div className="edit-card-cat">{categoryName(m.category)}</div>
                    )}
                    <h3 className="edit-card-title">{m.title}</h3>
                    {m.excerpt && <p className="edit-card-excerpt">{m.excerpt}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
