'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/* The results header: a live count and a sort control, matching
 * tgs_venues_v2.
 *
 * Only the orders that map to real data are offered. "Recommended" is the
 * tier order (the default). "Highest Rated" sorts by rating. The mockup's
 * two price orders and "Newest Listed" are held back: there is no price on
 * a venue yet, and the card view carries no listing date to sort on. */
export default function ResultsBar({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const sort = params.get('sort') ?? '';

  const change = (value: string) => {
    const q = new URLSearchParams(params.toString());
    if (value) q.set('sort', value); else q.delete('sort');
    router.push(q.toString() ? `/venues?${q}` : '/venues');
  };

  return (
    <div className="results-header">
      <div className="results-count">
        Showing <strong>{total}</strong> venues worldwide
      </div>
      <div className="results-sort">
        <label htmlFor="sort">Sort by</label>
        <select id="sort" value={sort} onChange={(e) => change(e.target.value)}>
          <option value="">Recommended</option>
          <option value="rating">Highest Rated</option>
          <option value="specials">Specials First</option>
        </select>
      </div>
    </div>
  );
}
