import { toXml, venueEntries, xmlResponse } from '@/lib/sitemap';

// Built on request, not at build time — a sitemap prerendered during
// the build is frozen at the moment of deploy.
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/* Venue pages. Test records excluded — nine of the nine venues currently
 * published carry "(Test)" in the name, and submitting them tells a
 * crawler the collection is nine made-up places. */
export async function GET() {
  return xmlResponse(toXml(await venueEntries()));
}
