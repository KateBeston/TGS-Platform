import { legalEntries, toXml, xmlResponse } from '@/lib/sitemap';

// Built on request, not at build time — a sitemap prerendered during
// the build is frozen at the moment of deploy.
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/* Legal documents. Indexed so they can be found when looked for, at a
 * low priority because a policy is not something to rank for. */
export async function GET() {
  return xmlResponse(toXml(await legalEntries()));
}
