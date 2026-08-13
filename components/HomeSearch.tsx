'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LocationField from '@/components/LocationField';

/* The search in the hero.
 *
 * An entry point rather than the search — it hands off to /venues (or the
 * experiences page), where the full filter lives and results render.
 *
 * Settings come from the database via props, so the list is always complete;
 * "Looking for" covers the three things the platform is actually for —
 * retreat venues, wellness venues, and wellness experiences; and Location is
 * a type-ahead over all five geography levels.
 */

type Setting = { name: string; slug: string };

const KIND = [
  ['', 'Anything'],
  ['Retreat', 'A retreat venue'],
  ['Wellness', 'A wellness venue'],
  ['experience', 'A wellness experience'],
];

export default function HomeSearch({ settings }: { settings: Setting[] }) {
  const router = useRouter();
  const [f, setF] = useState({ marketplace: '', setting: '', guests: '' });
  const [location, setLocation] = useState<Record<string, string>>({});

  const go = () => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(location)) if (v) q.set(k, v);
    if (f.setting) q.set('setting', f.setting);

    // Wellness experiences live on their own page with their own shape, so
    // that choice routes there; guests and marketplace do not apply.
    if (f.marketplace === 'experience') {
      router.push(q.toString() ? `/wellness-experiences?${q}` : '/wellness-experiences');
      return;
    }

    if (f.marketplace) q.set('marketplace', f.marketplace);
    if (f.guests) q.set('guests', f.guests);
    router.push(q.toString() ? `/venues?${q}` : '/venues');
  };

  return (
    <div className="hero-glass">
      <div className="hero-search">
        <div className="search-field">
          <label className="search-field-label" htmlFor="h-kind">Looking for</label>
          <select id="h-kind" value={f.marketplace}
            onChange={(e) => setF({ ...f, marketplace: e.target.value })}>
            {KIND.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="search-divider" />

        <LocationField onSelect={(params) => setLocation(params)} />

        <div className="search-divider" />

        <div className="search-field">
          <label className="search-field-label" htmlFor="h-set">Setting</label>
          <select id="h-set" value={f.setting}
            onChange={(e) => setF({ ...f, setting: e.target.value })}>
            <option value="">Anywhere</option>
            {settings.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>

        <div className="search-divider" />

        <div className="search-field">
          <label className="search-field-label" htmlFor="h-guests">For how many</label>
          <input id="h-guests" type="number" min={1} inputMode="numeric"
            placeholder="Any number" value={f.guests}
            onChange={(e) => setF({ ...f, guests: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && go()} />
        </div>

        <button type="button" className="hero-search-go" onClick={go}>Search</button>
      </div>
    </div>
  );
}
