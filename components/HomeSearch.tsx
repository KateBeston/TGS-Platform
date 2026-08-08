'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/* The search in the hero.
 *
 * Three fields and a button, over the image. It is an entry point rather
 * than the search — it hands off to /venues, where the full filter lives
 * and where results actually render.
 *
 * The mockup opens a panel for each field. Plain selects instead: a
 * custom panel over a hero image is three states to manage and one more
 * thing to break on a phone, for no gain over a control the browser
 * already renders well.
 */

const KIND = [
  ['', 'Anything'],
  ['Retreat', 'A venue to host a retreat'],
  ['Wellness', 'Somewhere to visit'],
];

const GUESTS = [
  ['', 'Any number'],
  ['2', 'Just us'],
  ['10', 'Around ten'],
  ['20', 'Around twenty'],
  ['40', 'Forty or more'],
];

export default function HomeSearch() {
  const router = useRouter();
  const [f, setF] = useState({ marketplace: '', setting: '', guests: '' });

  const go = () => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
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

        <div className="search-field">
          <label className="search-field-label" htmlFor="h-set">Setting</label>
          <select id="h-set" value={f.setting}
            onChange={(e) => setF({ ...f, setting: e.target.value })}>
            <option value="">Anywhere</option>
            <option value="beachfront">Beachfront</option>
            <option value="coastal">Coastal</option>
            <option value="mountain">Mountain</option>
            <option value="rainforest">Rainforest</option>
            <option value="thermal-springs">Thermal springs</option>
            <option value="secluded">Secluded</option>
            <option value="urban">Urban</option>
          </select>
        </div>

        <div className="search-divider" />

        <div className="search-field">
          <label className="search-field-label" htmlFor="h-guests">For how many</label>
          <select id="h-guests" value={f.guests}
            onChange={(e) => setF({ ...f, guests: e.target.value })}>
            {GUESTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <button type="button" className="hero-search-go" onClick={go}>Search</button>
      </div>
    </div>
  );
}
