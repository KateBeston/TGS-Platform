'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Facet } from '@/lib/venues';

/* The advanced-search modal, ported from tgs_venues_v2.
 *
 * A venue-type chooser (Retreat / Wellness / Both) opens a filter dialog
 * scoped to that type: venue-type options, setting, a modality tree, and
 * a group-size range. Every count is LIVE — recomputed from the facet
 * rows on each toggle, so a number never lies. Apply writes the search
 * params and the page's server query re-filters the listings. */

type Opt = { id: number; name: string; slug: string; applies_to?: string | null };
type Cat = { id: number; name: string; slug: string; in_retreat: boolean; in_wellness: boolean };
type Prac = { id: number; name: string; slug: string; category_slug: string };

export default function VenueAdvancedSearch({
  types, settings, categories, practices, facets,
}: {
  types: Opt[]; settings: Opt[]; categories: Cat[]; practices: Prac[]; facets: Facet[];
}) {
  const router = useRouter();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [market, setMarket] = useState<'Retreat' | 'Wellness' | 'Both' | null>(null);
  const [sel, setSel] = useState<{ types: string[]; settings: string[]; practices: string[]; guests: number }>(
    { types: [], settings: [], practices: [], guests: 0 },
  );

  const base = useMemo(
    () => facets.filter((f) => !market || market === 'Both' || f.marketplace === market),
    [facets, market],
  );

  type Sel = typeof sel;
  const run = (fs: Facet[], s: Sel) => fs.filter((f) =>
    (!s.types.length || (f.type != null && s.types.includes(f.type)))
    && (!s.settings.length || f.settings.some((x) => s.settings.includes(x)))
    && (!s.practices.length || f.practices.some((x) => s.practices.includes(x)))
    && (!s.guests || (f.guests != null && f.guests >= s.guests)));

  const total = useMemo(() => run(base, sel).length, [base, sel]);
  const exceptTypes = useMemo(() => run(base, { ...sel, types: [] }), [base, sel]);
  const exceptSettings = useMemo(() => run(base, { ...sel, settings: [] }), [base, sel]);
  const exceptPractices = useMemo(() => run(base, { ...sel, practices: [] }), [base, sel]);

  const typeCount = (slug: string) => exceptTypes.filter((f) => f.type === slug).length;
  const settingCount = (slug: string) => exceptSettings.filter((f) => f.settings.includes(slug)).length;
  const practiceCount = (slug: string) => exceptPractices.filter((f) => f.practices.includes(slug)).length;

  const typesFor = types.filter((t) => !market || market === 'Both'
    || t.applies_to === market || t.applies_to === 'Both' || !t.applies_to);
  const catsFor = categories.filter((c) => !market || market === 'Both'
    || (market === 'Retreat' ? c.in_retreat : c.in_wellness));
  const pracsIn = (catSlug: string) => practices.filter((p) => p.category_slug === catSlug);

  const maxGuests = Math.max(40, ...facets.map((f) => f.guests ?? 0));
  const marketCount = (m: string) => facets.filter((f) => m === 'Both' || f.marketplace === m).length;

  const toggle = (dim: 'types' | 'settings' | 'practices', slug: string) =>
    setSel((s) => ({ ...s, [dim]: s[dim].includes(slug) ? s[dim].filter((x) => x !== slug) : [...s[dim], slug] }));
  const clear = () => setSel({ types: [], settings: [], practices: [], guests: 0 });
  const closeAll = () => { setChooserOpen(false); setMarket(null); };

  const apply = () => {
    const p = new URLSearchParams();
    if (market && market !== 'Both') p.set('marketplace', market);
    if (sel.types[0]) p.set('type', sel.types[0]);
    if (sel.settings[0]) p.set('setting', sel.settings[0]);
    if (sel.practices[0]) p.set('practice', sel.practices[0]);
    if (sel.guests) p.set('guests', String(sel.guests));
    closeAll(); clear();
    router.push(`/venues${p.toString() ? `?${p.toString()}` : ''}`);
  };

  const CHOICES: [typeof market, string, string, string][] = [
    ['Retreat', 'Retreat Venues', 'Dedicated spaces for hosting retreats and programs.', '\u25D0'],
    ['Wellness', 'Wellness Venues', 'Day spas, thermal springs, healing centres and wellness resorts.', '\u25D1'],
    ['Both', 'All Venues', 'Search across the full collection.', '\u25C9'],
  ];

  return (
    <>
      <button type="button" className="adv-search-trigger" onClick={() => setChooserOpen(true)}>
        Advanced Search
      </button>

      {/* venue-type chooser */}
      <div className={`chooser-overlay${chooserOpen ? ' open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setChooserOpen(false); }}>
        <div className="chooser-dialog">
          <button type="button" className="chooser-close" onClick={() => setChooserOpen(false)} aria-label="Close">&times;</button>
          <div className="chooser-header">
            <div className="chooser-eyebrow">Refine Your Search</div>
            <div className="chooser-title">Refine which <em>venues?</em></div>
            <div className="chooser-subtitle">Each venue type has its own set of advanced filters. Choose to continue.</div>
          </div>
          <div className="chooser-options">
            {CHOICES.map(([m, name, desc, icon]) => (
              <button key={name} type="button" className="chooser-option"
                onClick={() => { setMarket(m); setChooserOpen(false); }}>
                <span className="chooser-option-icon" aria-hidden="true">{icon}</span>
                <span className="chooser-option-content">
                  <span className="chooser-option-name">{name}</span>
                  <span className="chooser-option-desc">{desc}</span>
                  <span className="chooser-option-count">{marketCount(m as string)} venues</span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="chooser-cancel" onClick={() => setChooserOpen(false)}>Cancel</button>
        </div>
      </div>

      {/* advanced filter modal */}
      <div className={`modal-overlay${market ? ' open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeAll(); }}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-header-left">
              <button type="button" className="modal-back"
                onClick={() => { setMarket(null); setChooserOpen(true); }}>&larr; Back to venue type</button>
              <div className="modal-title">
                Advanced Search{market && market !== 'Both' ? `, ${market} Venues` : ''}
              </div>
            </div>
            <button type="button" className="modal-close" onClick={closeAll} aria-label="Close">&times;</button>
          </div>

          <div className="modal-body">
            <div className="modal-results-summary">
              <div className="modal-results-count">
                <strong>{total}</strong>{total === 1 ? 'venue' : 'venues'} match your filters
              </div>
              <div className="modal-results-hint">Counts update as you select</div>
            </div>

            {typesFor.length > 0 && (
              <div className="modal-section">
                <div className="modal-section-title">Venue Type</div>
                <div className="modal-grid">
                  {typesFor.map((t) => (
                    <button key={t.slug} type="button"
                      className={`modal-option${sel.types.includes(t.slug) ? ' selected' : ''}`}
                      onClick={() => toggle('types', t.slug)}>
                      {t.name} <span className="opt-count">({typeCount(t.slug)})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-section">
              <div className="modal-section-title">Setting</div>
              <div className="modal-grid">
                {settings.map((s) => (
                  <button key={s.slug} type="button"
                    className={`modal-option${sel.settings.includes(s.slug) ? ' selected' : ''}`}
                    onClick={() => toggle('settings', s.slug)}>
                    {s.name} <span className="opt-count">({settingCount(s.slug)})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">Modality</div>
              {catsFor.map((c) => {
                const ps = pracsIn(c.slug);
                if (!ps.length) return null;
                return (
                  <div key={c.slug} className="modal-modality-category">
                    <div className="modal-modality-parent">{c.name}</div>
                    <div className="modal-modality-children">
                      {ps.map((p) => (
                        <button key={p.slug} type="button"
                          className={`modal-modality-child${sel.practices.includes(p.slug) ? ' selected' : ''}`}
                          onClick={() => toggle('practices', p.slug)}>
                          {p.name} <span className="opt-count">({practiceCount(p.slug)})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-section">
              <div className="modal-section-title">Group Size</div>
              <div className="modal-range">
                <input type="range" min={0} max={maxGuests} step={2} value={sel.guests}
                  onChange={(e) => setSel((s) => ({ ...s, guests: Number(e.target.value) }))} />
                <div className="modal-range-value">{sel.guests ? `${sel.guests}+ guests` : 'Any size'}</div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="modal-clear" onClick={clear}>Clear all filters</button>
            <button type="button" className="modal-apply" onClick={apply}>Apply Filters</button>
          </div>
        </div>
      </div>
    </>
  );
}
