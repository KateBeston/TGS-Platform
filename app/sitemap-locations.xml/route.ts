import { locationEntries, toXml, xmlResponse } from '@/lib/sitemap';

// Built on request, not at build time — a sitemap prerendered during
// the build is frozen at the moment of deploy.
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/* Country and city pages. Only places that actually have a venue —
 * a sitemap listing 245 countries when four have venues is a sitemap
 * making a claim it cannot support. */
export async function GET() {
  return xmlResponse(toXml(await locationEntries()));
}
