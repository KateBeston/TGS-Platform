import type { Metadata } from 'next';
import { Suspense } from 'react';
import VenueCard from '@/components/VenueCard';
import VenueFilters from '@/components/VenueFilters';
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

  const groups = ([1, 2, 3, 4] as const)
    .map((t) => ({ size: t, cards: cards.filter((c) => bucket(c.tier_order) === t) }))
    .filter((g) => g.cards.length);

  return (
    <>
      {groups.map((group, i) => {
        const size = group.size;
        return (
          <div key={i} className={`vgrid vgrid-${size}`}>
            {group.cards.map((c) => <VenueCard key={c.id} card={c} size={size} />)}
          </div>
        );
      })}
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
      <section className="page-head">
        <div className="wrap">
          <div className="eyebrow">Discover</div>
          <h1>Explore our venues</h1>
          <p className="page-sub">
            Retreat centres, wellness resorts, thermal sanctuaries, and sacred
            spaces, curated from around the world.
          </p>
        </div>
      </section>

      <div className="wrap">
        <Suspense fallback={<div className="filters" />}>
          <VenueFilters
            countries={options.countries}
            types={options.types}
            settings={options.settings}
            categories={options.categories}
            total={result.cards.length} />
        </Suspense>

        {result.error ? (
          <div className="empty">
            <h2>The venues could not be loaded</h2>
            <p>{result.error}</p>
          </div>
        ) : (
          <Results cards={result.cards} />
        )}
      </div>
    </>
  );
}
