import RetreatVenue from './RetreatVenue';
import WellnessVenue from './WellnessVenue';
import { marketplaceOf } from '@/lib/venue';

/* The venue detail, lifted out of the old [marketplace]/[slug] route so the
   marketplace catch-all can render it unchanged. URLs are byte-identical. */
export default function VenueDetail({ v, marketplace, slug }: { v: any; marketplace: string; slug: string }) {
  const isRetreat = marketplaceOf(marketplace) === 'Retreat';

  const structured = {
    '@context': 'https://schema.org',
    '@type': isRetreat ? 'LodgingBusiness' : 'HealthAndBeautyBusiness',
    name: v.venue_name,
    description: v.listing_description ?? v.venue_short_description,
    image: v.image_url ?? undefined,
    url: `https://www.theglobalsanctum.com/${marketplace}/${slug}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: v.city ?? undefined,
      addressRegion: v.state ?? undefined,
      addressCountry: v.country ?? undefined,
    },
    geo: v.latitude ? { '@type': 'GeoCoordinates', latitude: v.latitude, longitude: v.longitude } : undefined,
    aggregateRating: v.rating ? {
      '@type': 'AggregateRating', ratingValue: v.rating,
      reviewCount: v.review_count, bestRating: 5, worstRating: 1,
    } : undefined,
    makesOffer: (v.services ?? []).slice(0, 20).map((s: any) => ({
      '@type': 'Offer', name: s.name,
      price: s.base_price ?? undefined, priceCurrency: s.currency ?? undefined,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
      {isRetreat ? <RetreatVenue v={v} /> : <WellnessVenue v={v} />}
    </>
  );
}
