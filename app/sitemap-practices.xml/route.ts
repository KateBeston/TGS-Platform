import { practiceEntries, toXml, xmlResponse } from '@/lib/sitemap';

// Built on request, not at build time — a sitemap prerendered during
// the build is frozen at the moment of deploy.
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/* Category and practice hubs, where they have venues.
 *
 * There are 114 practices and 42 have something on them. Submitting the
 * other 72 is submitting 72 empty pages, which is how a site teaches a
 * crawler that its pages are thin. They still exist and still render;
 * they are simply not advertised until there is something on them. */
export async function GET() {
  return xmlResponse(toXml(await practiceEntries()));
}
