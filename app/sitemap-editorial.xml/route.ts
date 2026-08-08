import { articles } from '@/lib/sanity';
import { toXml, xmlResponse } from '@/lib/sitemap';

// Built on request, not at build time — a sitemap prerendered during
// the build is frozen at the moment of deploy.
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/* The Wellness Edit. Test posts are already filtered by the query that
 * fetches them, so nothing extra is needed here. */
export async function GET() {
  const posts = await articles(500);

  return xmlResponse(toXml([
    { url: '/the-wellness-edit', changeFrequency: 'weekly', priority: 0.8 },
    ...posts.map((a) => ({
      url: `/the-wellness-edit/${a.slug}`,
      lastModified: a._updatedAt ?? a.publishedAt ?? undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]));
}
