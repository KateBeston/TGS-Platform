'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Option = { id?: number; name: string; slug?: string; applies_to?: string;
                in_retreat?: boolean; in_wellness?: boolean; count?: number };

/* The progressive search bar, above the results.
 *
 * One segmented control — Where, Venue Type, Setting, Modality — and a
 * Search button, matching tgs_venues_v2. Each segment opens a panel of
 * real, database-backed options with counts; the lists are never written
 * into the page. "Venue Type" is the marketplace (Retreat vs Wellness),
 * which scopes the modality list, exactly as the select-based filter did.
 *
 * Price and guest-count are not here yet: there is no price on a venue,
 * and the mockup keeps guests out of the bar. Both come back as the venue
 * detail gains a price. */

type SegKey = 'country' | 'marketplace' | 'setting' | 'practice';

const MARKETS: Option[] = [
  { slug: '', name: 'All Venues' },
  { slug: 'Retreat', name: 'Retreat Venue' },
  { slug: 'Wellness', name: 'Wellness Venue' },
];

export default function VenueSearch({
  countries, settings, categories,
}: {
  countries: Option[]; settings: Option[]; categories: Option[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [f, setF] = useState({
    country: params.get('country') ?? '',
    marketplace: params.get('marketplace') ?? '',
    setting: params.get('setting') ?? '',
    practice: params.get('practice') ?? '',
  });
  const [open, setOpen] = useState<SegKey | null>(null);

  // Modality is scoped to the marketplace, because a retreat host and a
  // wellness guest are not looking for the same practices.
  const practices = f.marketplace === 'Wellness'
    ? categories.filter((c) => c.in_wellness)
    : f.marketplace === 'Retreat'
      ? categories.filter((c) => c.in_retreat)
      : categories.filter((c) => c.in_wellness || c.in_retreat);

  const segments: {
    key: SegKey; label: string; placeholder: string; title: string; options: Option[];
  }[] = [
    { key: 'country',     label: 'Where',      placeholder: 'Anywhere',       title: 'Where to?',           options: countries },
    { key: 'marketplace', label: 'Venue Type', placeholder: 'All venues',     title: 'What kind of venue?', options: MARKETS },
    { key: 'setting',     label: 'Setting',    placeholder: 'All settings',   title: 'Setting',             options: settings },
    { key: 'practice',    label: 'Modality',   placeholder: 'All modalities', title: 'Modality',            options: practices },
  ];

  const nameFor = (key: SegKey) => {
    const seg = segments.find((s) => s.key === key)!;
    const opt = seg.options.find((o) => (o.slug ?? '') === f[key]);
    return opt && f[key] ? opt.name : null;
  };

  const choose = (key: SegKey, value: string) => {
    const next = { ...f, [key]: value };
    // Changing the marketplace invalidates the modality, which is scoped
    // to it.
    if (key === 'marketplace') next.practice = '';
    setF(next);
    setOpen(null);
  };

  const search = () => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
    // Keep the chosen sort order across a new search.
    const sort = params.get('sort');
    if (sort) q.set('sort', sort);
    router.push(q.toString() ? `/venues?${q}` : '/venues');
  };

  const active = open ? segments.find((s) => s.key === open)! : null;

  return (
    <section className="filter-section">
      <div className="filter-section-inner">
        <div className="search-bar-wrap">
          <div className="search-bar-inner">
            <div className="progressive-bar-row">
              <div className="progressive-bar">
                {segments.map((seg) => {
                  const value = nameFor(seg.key);
                  return (
                    <button
                      key={seg.key}
                      type="button"
                      className={`progressive-segment${open === seg.key ? ' active' : ''}`}
                      onClick={() => setOpen(open === seg.key ? null : seg.key)}>
                      <span className="progressive-segment-label">{seg.label}</span>
                      <span className={`progressive-segment-value${value ? '' : ' placeholder'}`}>
                        {value ?? seg.placeholder}
                      </span>
                    </button>
                  );
                })}
                <button type="button" className="progressive-search-btn" onClick={search}>
                  Search
                </button>
              </div>
            </div>

            {active && (
              <div className="progressive-panel">
                <div className="progressive-panel-title">{active.title}</div>
                <div className="panel-options-list">
                  <button
                    type="button"
                    className={`panel-option${f[active.key] ? '' : ' selected'}`}
                    onClick={() => choose(active.key, '')}>
                    <span className="panel-option-content">
                      <span className="panel-option-name">{active.placeholder}</span>
                    </span>
                  </button>
                  {active.options
                    .filter((o) => (o.slug ?? '') !== '')
                    .map((o) => (
                      <button
                        key={o.slug}
                        type="button"
                        className={`panel-option${f[active.key] === o.slug ? ' selected' : ''}`}
                        onClick={() => choose(active.key, o.slug ?? '')}>
                        <span className="panel-option-content">
                          <span className="panel-option-name">{o.name}</span>
                        </span>
                        {o.count ? <span className="panel-option-count">{o.count}</span> : null}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
