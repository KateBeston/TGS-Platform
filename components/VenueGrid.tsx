import VenueCard from './VenueCard';
import type { Card } from '@/lib/venues';

const GRIDS = ['premium-grid', 'featured-grid', 'standard-grid', 'essentials-grid'];
const bucket = (t: number | null | undefined) => Math.min(t ?? 4, 4) as 1 | 2 | 3 | 4;

/* The tiered grid, reused across the catalogue and location pages so a venue
   presents identically wherever it is listed. */
/* The tier headings are gone. They named the commercial tiers to a guest —
   "Essentials Listings" told somebody which venues paid least, and that is
   ours to know, not theirs. The ordering and the card sizes carry the same
   weight without saying so.
   The labels prop is kept so existing callers do not break, and now does
   nothing. */
export default function VenueGrid({ cards }: { cards: Card[]; labels?: boolean }) {
  const groups = ([1, 2, 3, 4] as const)
    .map((t) => ({ size: t, cards: cards.filter((c) => bucket(c.tier_order) === t) }))
    .filter((g) => g.cards.length);
  return (
    <>
      {groups.map((group) => (
        <div key={group.size} className="tier-block">
          <div className={GRIDS[group.size - 1]}>
            {group.cards.map((c) => <VenueCard key={c.id} card={c} size={group.size} />)}
          </div>
        </div>
      ))}
    </>
  );
}
