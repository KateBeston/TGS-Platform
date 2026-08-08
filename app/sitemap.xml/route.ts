import { articles } from '@/lib/sanity';
import { STATIC_PAGES, toXml, xmlResponse } from '@/lib/sitemap';

// Built on request, not at build time. A sitemap prerendered during the
// build is a sitemap frozen at the moment of deploy — it would list the
// venues that existed then and nothing published since.
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/* The main sitemap: the pages not generated from a table, plus the
 * editorial.
 *
 * robots.txt names all six files individually and search engines read
 * them from there, so this stays a plain urlset rather than an index. */
export async function GET() {
  const posts = await articles(200);

  return xmlResponse(toXml([
    ...STATIC_PAGES,
    ...posts.map((a) => ({
      url: `/the-wellness-edit/${a.slug}`,
      lastModified: a._updatedAt ?? a.publishedAt ?? undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]));
}
