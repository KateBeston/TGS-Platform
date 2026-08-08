import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RetreatVenue from '@/components/venue/RetreatVenue';
import WellnessVenue from '@/components/venue/WellnessVenue';
import { loadVenue, marketplaceOf } from '@/lib/venue';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ marketplace: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { marketplace, slug } = await params;
  const v = await loadVenue(marketplace, slug);
  if (!v) return { title: 'Not found' };

  const place = [v.city, v.country].filter(Boolean).join(', ');

  // Its own title, description, canonical and image. At six thousand
  // venues that is six thousand pages each able to rank for its own
  // name, place and modality mix.
  return {
    title: `${v.headline ?? v.venue_name}${place ? ` — ${place}` : ''}`,
    description: v.listing_description ?? v.venue_short_description ?? undefined,
    alternates: { canonical: `/${marketplace}/${slug}` },
    openGraph: {
      title: v.headline ?? v.venue_name,
      description: v.listing_description ?? v.venue_short_description ?? undefined,
      images: v.image_url ? [v.image_url] : undefined,
      type: 'website',
    },
  };
}

export default async function VenuePage({ params }: Params) {
  const { marketplace, slug } = await params;
  const v = await loadVenue(marketplace, slug);
  if (!v) notFound();

  const isRetreat = marketplaceOf(marketplace) === 'Retreat';

  const structured = {
    '@context': 'https://schema.org',
    '@type': isRetreat ? 'LodgingBusiness' : 'HealthAndBeautyBusiness',
    name: v.venue_name,
    description: v.listing_description ?? v.venue_short_description,
    image: v.image_url ?? undefined,
    url: `https://www.theglobalsanctum.com/${marketplace}/${slug}`,
    // Locality only. The street is not public information and the town
    // is enough to place it.
    address: {
      '@type': 'PostalAddress',
      addressLocality: v.city ?? undefined,
      addressRegion: v.state ?? undefined,
      addressCountry: v.country ?? undefined,
    },
    geo: v.latitude ? {
      '@type': 'GeoCoordinates', latitude: v.latitude, longitude: v.longitude,
    } : undefined,
    aggregateRating: v.rating ? {
      '@type': 'AggregateRating', ratingValue: v.rating,
      reviewCount: v.review_count, bestRating: 5, worstRating: 1,
    } : undefined,
    makesOffer: v.services.slice(0, 20).map((s: any) => ({
      '@type': 'Offer', name: s.name,
      price: s.base_price ?? undefined, priceCurrency: s.currency ?? undefined,
    })),
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
      {/* Two templates, not one that adapts. A host booking a shala for
          eighteen and a guest booking a facial are answering different
          questions, and a page serving both serves neither. */}
      {isRetreat ? <RetreatVenue v={v} /> : <WellnessVenue v={v} />}
    </>
  );
}
