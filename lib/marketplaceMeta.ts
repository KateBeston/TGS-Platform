import type { Metadata } from 'next';
import { loadVenue, marketplaceOf } from '@/lib/venue';
import { resolveLocation } from '@/lib/locations';

export async function marketplaceMetadata(marketplace: string, path: string[]): Promise<Metadata> {
  const kind = marketplaceOf(marketplace);
  const label = kind === 'Retreat' ? 'Retreat venues' : 'Wellness venues';

  if (path.length === 0) {
    return { title: `${label} — The Global Sanctum`, alternates: { canonical: `/${marketplace}` } };
  }

  const loc = await resolveLocation(path);
  if (loc) {
    const row = loc.row;
    return {
      title: row.meta_title ?? `${label} in ${row.name} — The Global Sanctum`,
      description: row.meta_description ?? undefined,
      alternates: { canonical: `/${marketplace}/${path.join('/')}` },
    };
  }

  if (path.length === 1) {
    const v = await loadVenue(marketplace, path[0]);
    if (v) {
      const place = [v.city, v.country].filter(Boolean).join(', ');
      return {
        title: `${v.headline ?? v.venue_name}${place ? ` — ${place}` : ''}`,
        description: v.listing_description ?? v.venue_short_description ?? undefined,
        alternates: { canonical: `/${marketplace}/${path[0]}` },
        openGraph: {
          title: v.headline ?? v.venue_name,
          description: v.listing_description ?? v.venue_short_description ?? undefined,
          images: v.image_url ? [v.image_url] : undefined,
          type: 'website',
        },
      };
    }
  }
  return { title: 'Not found' };
}
