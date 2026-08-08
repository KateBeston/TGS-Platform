'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Option = { id?: number; name: string; slug?: string; applies_to?: string;
                in_retreat?: boolean; in_wellness?: boolean; count?: number };

/* The search, above the results.
 *
 * Every list comes from the database. The audit blames the drift between
 * this filter and the rest of the site on lists being written into the
 * page — eight settings here, twenty-one in the database, and a dead
 * "Desert" option nobody could remove.
 *
 * Modality depends on venue type, because a retreat host and a wellness
 * guest are not looking for the same thing and the categories differ. */

export default function VenueFilters({
  countries, types, settings, categories, total,
}: {
  countries: Option[]; types: Option[]; settings: Option[];
  categories: Option[]; total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [f, setF] = useState({
    marketplace: params.get('marketplace') ?? '',
    country: params.get('country') ?? '',
    type: params.get('type') ?? '',
    setting: params.get('setting') ?? '',
    practice: params.get('practice') ?? '',
    guests: params.get('guests') ?? '',
  });

  const set = (k: string, v: string) => {
    const next = { ...f, [k]: v };
    // Changing the marketplace invalidates the type and the modality,
    // since both are scoped to it.
    if (k === 'marketplace') { next.type = ''; next.practice = ''; }
    setF(next);
  };

  const search = () => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
    router.push(q.toString() ? `/venues?${q}` : '/venues');
  };

  const clear = () => {
    setF({ marketplace: '', country: '', type: '', setting: '', practice: '', guests: '' });
    router.push('/venues');
  };

  // Types are scoped to a marketplace; showing all thirty-seven when
  // somebody has chosen Wellness offers them retreat centres.
  const typesShown = f.marketplace
    ? types.filter((t) => t.applies_to === f.marketplace)
    : types;

  const categoriesShown = f.marketplace === 'Wellness'
    ? categories.filter((c) => c.in_wellness)
    : f.marketplace === 'Retreat'
      ? categories.filter((c) => c.in_retreat)
      : [];

  const any = Object.values(f).some(Boolean);

  return (
    <div className="filters">
      <div className="filter-row">
        <div className="filter">
          <label htmlFor="marketplace">Looking for</label>
          <select id="marketplace" value={f.marketplace}
            onChange={(e) => set('marketplace', e.target.value)}>
            <option value="">Everything</option>
            <option value="Retreat">A venue to host a retreat</option>
            <option value="Wellness">Somewhere to visit</option>
          </select>
        </div>

        <div className="filter">
          <label htmlFor="country">Where</label>
          <select id="country" value={f.country}
            onChange={(e) => set('country', e.target.value)}>
            <option value="">Anywhere</option>
            {countries.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}{c.count ? ` (${c.count})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label htmlFor="type">Kind of place</label>
          <select id="type" value={f.type}
            onChange={(e) => set('type', e.target.value)}>
            <option value="">Any</option>
            {typesShown.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label htmlFor="setting">Setting</label>
          <select id="setting" value={f.setting}
            onChange={(e) => set('setting', e.target.value)}>
            <option value="">Any setting</option>
            {settings.map((s) => (
              <option key={s.slug ?? s.name} value={s.slug ?? s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Only once a marketplace is chosen. The categories differ
            between the two and offering both at once means offering
            somebody a category their venue type cannot have. */}
        <div className="filter">
          <label htmlFor="practice">Modality</label>
          <select id="practice" value={f.practice} disabled={!f.marketplace}
            onChange={(e) => set('practice', e.target.value)}>
            <option value="">
              {f.marketplace ? 'Any modality' : 'Choose what you are looking for first'}
            </option>
            {categoriesShown.map((c) => (
              <option key={c.slug ?? c.name} value={c.slug ?? c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="filter filter-narrow">
          <label htmlFor="guests">For how many</label>
          <input id="guests" type="number" min={1} placeholder="Any"
            value={f.guests} onChange={(e) => set('guests', e.target.value)} />
        </div>

        <button type="button" className="filter-go" onClick={search}>Search</button>
      </div>

      <div className="filter-foot">
        <span>{total} venue{total === 1 ? '' : 's'}</span>
        {any && (
          <button type="button" className="filter-clear" onClick={clear}>
            Clear everything
          </button>
        )}
      </div>
    </div>
  );
}
