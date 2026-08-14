import { notFound } from 'next/navigation';
import { loadVenue } from '@/lib/venue';
import { resolveLocation } from '@/lib/locations';
import VenueDetail from '@/components/venue/VenueDetail';
import LocationView from '@/components/location/LocationView';
import MarketplaceCatalogue from '@/components/MarketplaceCatalogue';

/* One resolver for everything under /wellness-venues and /retreat-venues:
   empty path → catalogue; a real published place → location page; a single
   segment that is not a place → venue detail; anything else → 404. Location
   is tried first because it validates strictly against the geography tables. */
export default async function MarketplaceRouter({ marketplace, path }: { marketplace: string; path: string[] }) {
  if (path.length === 0) return <MarketplaceCatalogue marketplace={marketplace} />;

  const loc = await resolveLocation(path);
  if (loc) return <LocationView marketplace={marketplace} loc={loc} />;

  if (path.length === 1) {
    const v = await loadVenue(marketplace, path[0]);
    if (v) return <VenueDetail v={v} marketplace={marketplace} slug={path[0]} />;
  }
  notFound();
}
