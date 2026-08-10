import type { Metadata } from 'next';
import { Suspense } from 'react';
import VenueCard from '@/components/VenueCard';
import VenueSearch from '@/components/VenueSearch';
import ResultsBar from '@/components/ResultsBar';
import { filterOptions, venueCards, type Card } from '@/lib/venues';

export const dynamic = 'force-dynamic';

// Its own title and description. The audit found /about, /contact and
// /studio all serving the home page's, which suppresses rankings across
// the whole site.
export const metadata: Metadata = {
  title: 'Retreat venues and wellness sanctuaries, globally curated',
  description:
    'Retreat centres, wellness resorts, thermal sanctuaries and sacred spaces, '
    + 'curated from around the world. Search by place, setting and modality.',
  alternates: { canonical: '/venues' },
};

/* Grouped by tier, and the groups are not labelled.
 *
 * The mockup headed them "Premium Sanctuaries", "Standard Listings",
 * "Essentials Listings" — which shows a guest the pricing model and tells
 * them which venue paid the least. The ordering and the card sizes carry
 * the same commercial weight without saying so. */
function Results({ cards }: { cards: Card[] }) {
  if (!cards.length) {
    return (
      <div className="empty">
        <h2>Nothing matches that yet</h2>
        <p>
          Try fewer filters, or tell us what you are after and we will look
          properly &mdash; including places not yet on the platform.
        </p>
        <a className="btn-solid" href="/contact">Tell us what you need</a>
      </div>
    );
  }

  // A venue with no active subscription sits with Essentials rather than
  // in a fifth group of its own — otherwise the group index makes it the
  // largest card on the page, which is the opposite of intended.
  const bucket = (t: number | null) => Math.min(t ?? 4, 4) as 1 | 2 | 3 | 4;

  const grids = ['premium-grid', 'featured-grid', 'standard-grid', 'essentials-grid'];
  const TIER_LABELS = ['Premium Sanctuaries', 'Featured Venues', 'Standard Listings', 'Essentials Listings'];

  const groups = ([1, 2, 3, 4] as const)
    .map((t) => ({ size: t, cards: cards.filter((c) => bucket(c.tier_order) === t) }))
    .filter((g) => g.cards.length);

  return (
    <>
      {groups.map((group) => (
        // No heading. The mockup labelled these "Premium Sanctuaries" and
        // "Essentials Listings", which shows a guest the pricing model
        // and tells them which venue paid the least. The shape and the
        // order carry the same commercial weight silently.
        <div key={group.size} className="tier-block">
          <div className="tier-section-header">
            <span className="tier-section-label">{TIER_LABELS[group.size - 1]}</span>
            <span className="tier-section-count">{group.cards.length} {group.cards.length === 1 ? 'venue' : 'venues'}</span>
          </div>
          <div className={grids[group.size - 1]}>
            {group.cards.map((c) => (
              <VenueCard key={c.id} card={c} size={group.size} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const [options, result] = await Promise.all([
    filterOptions(),
    venueCards({
      marketplace: sp.marketplace,
      country: sp.country,
      type: sp.type,
      setting: sp.setting,
      practice: sp.practice,
      guests: sp.guests ? Number(sp.guests) : undefined,
      sort: sp.sort,
    }),
  ]);

  return (
    <>
      <section className="vhero">
        <div className="vhero-image" />
        <div className="vhero-content">
          <div className="vhero-eyebrow">Discover</div>
          <h1 className="vhero-title">Explore Our Venues</h1>
        </div>
      </section>

      <Suspense fallback={<div className="filter-section" />}>
        <VenueSearch
          countries={options.countries}
          settings={options.settings}
          categories={options.categories} />
      </Suspense>

      {result.error ? (
        <div className="listings-wrap">
          <div className="empty">
            <h2>The venues could not be loaded</h2>
            <p>{result.error}</p>
          </div>
        </div>
      ) : (
        <>
          <Suspense fallback={null}>
            <ResultsBar total={result.cards.length} />
          </Suspense>
          <div className="listings-wrap">
            <Results cards={result.cards} />
          </div>
        </>
      )}
    </>
  );
}
