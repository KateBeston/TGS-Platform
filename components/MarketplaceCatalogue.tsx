import { venueCards } from '@/lib/venues';
import { marketplaceOf } from '@/lib/venue';
import VenueGrid from '@/components/VenueGrid';

export default async function MarketplaceCatalogue({ marketplace }: { marketplace: string }) {
  const kind = marketplaceOf(marketplace);
  const label = kind === 'Retreat' ? 'Retreat venues' : 'Wellness venues';
  const { cards } = await venueCards({ marketplace: kind ?? undefined });
  return (
    <div className="loc-page">
      <header className="loc-hero">
        <p className="loc-eyebrow">The Global Sanctum</p>
        <h1>{label}</h1>
        <p className="loc-intro">
          {kind === 'Retreat'
            ? 'Venues for exclusive hire — retreats, gatherings and programmes, curated the world over.'
            : 'Spas, studios and sanctuaries for wellness experiences, curated the world over.'}
        </p>
      </header>
      <section className="loc-venues"><VenueGrid cards={cards} /></section>
    </div>
  );
}
