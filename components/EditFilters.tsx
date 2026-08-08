'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/* Search The Wellness Edit.
 *
 * Category, author, date and sort, as on the live page.
 *
 * The categories offered are the ones articles actually carry — Form,
 * Pulse, Philosophy and so on. The live page offers eleven themes that
 * no article has, so every one of them returns nothing. A filter that
 * cannot match is worse than no filter, because somebody uses it once
 * and concludes the collection is empty. */

const WHEN = [
  ['', 'Any time'],
  ['7', 'Past 7 days'],
  ['30', 'Past 30 days'],
  ['90', 'Past 3 months'],
  ['180', 'Past 6 months'],
  ['365', 'Past year'],
];

const SORT = [
  ['', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['longest', 'Longest read'],
];

export default function EditFilters({
  categories, authors, categoryName,
}: {
  categories: string[];
  authors: string[];
  categoryName: (c: string) => string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [f, setF] = useState({
    category: params.get('category') ?? '',
    author: params.get('author') ?? '',
    within: params.get('within') ?? '',
    sort: params.get('sort') ?? '',
  });

  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const go = () => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
    router.push(q.toString() ? `/the-wellness-edit?${q}` : '/the-wellness-edit');
  };

  const clear = () => {
    setF({ category: '', author: '', within: '', sort: '' });
    router.push('/the-wellness-edit');
  };

  const any = Object.values(f).some(Boolean);

  return (
    <div className="edit-search">
      <div className="edit-search-head">Search The Wellness Edit</div>

      <div className="edit-search-row">
        <div className="filter">
          <label htmlFor="e-cat">Section</label>
          <select id="e-cat" value={f.category}
            onChange={(e) => set('category', e.target.value)}>
            <option value="">Every section</option>
            {categories.map((c) => (
              <option key={c} value={c}>{categoryName(c)}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label htmlFor="e-author">Written by</label>
          <select id="e-author" value={f.author}
            onChange={(e) => set('author', e.target.value)}>
            <option value="">Anyone</option>
            {authors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="filter">
          <label htmlFor="e-when">Published</label>
          <select id="e-when" value={f.within}
            onChange={(e) => set('within', e.target.value)}>
            {WHEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="filter">
          <label htmlFor="e-sort">Order</label>
          <select id="e-sort" value={f.sort}
            onChange={(e) => set('sort', e.target.value)}>
            {SORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <button type="button" className="filter-go" onClick={go}>Search</button>
      </div>

      {any && (
        <div className="edit-search-foot">
          <button type="button" className="filter-clear" onClick={clear}>
            Clear everything
          </button>
        </div>
      )}
    </div>
  );
}
