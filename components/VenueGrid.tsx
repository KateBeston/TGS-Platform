import VenueCard from './VenueCard';
import type { Card } from '@/lib/venues';

const GRIDS = ['premium-grid', 'featured-grid', 'standard-grid', 'essentials-grid'];
const TIER_LABELS = ['Premium Sanctuaries', 'Featured Venues', 'Standard Listings', 'Essentials Listings'];
const bucket = (t: number | null | undefined) => Math.min(t ?? 4, 4) as 1 | 2 | 3 | 4;

/* The tiered grid, reused across the catalogue and location pages so a venue
   presents identically wherever it is listed. */
export default function VenueGrid({ cards, labels = true }: { cards: Card[]; labels?: boolean }) {
  const groups = ([1, 2, 3, 4] as const)
    .map((t) => ({ size: t, cards: cards.filter((c) => bucket(c.tier_order) === t) }))
    .filter((g) => g.cards.length);
  return (
    <>
      {groups.map((group) => (
        <div key={group.size} className="tier-block">
          {labels && (
            <span className="tier-section-label">{TIER_LABELS[group.size - 1]}</span>
          )}
          <div className={GRIDS[group.size - 1]}>
            {group.cards.map((c) => <VenueCard key={c.id} card={c} size={group.size} />)}
          </div>
        </div>
      ))}
    </>
  );
}
