'use client';

import Link from 'next/link';
import { useState } from 'react';

type Practice = { name: string; slug: string; venue_count?: number };
type Cat = {
  id: number | string;
  name: string;
  slug: string;
  description?: string | null;
  tagline?: string | null;
  image_url?: string | null;
  practices: Practice[];
};

/* The category accordion for the Wellness Experiences index.
 *
 * Each row toggles a panel open in the browser. The practices inside
 * each panel are real links to /wellness-experiences/[category]/[practice],
 * so the shareable, indexable practice pages are still reachable — the
 * expand is a preview, the link is the destination. */

export default function ExperienceAccordion({ categories }: { categories: Cat[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  return (
    <div className="categories">
      {categories.map((c, i) => {
        const isOpen = openSlug === c.slug;
        const count = c.practices.length;
        return (
          <div key={c.id} className={`category-item${isOpen ? ' open' : ''}`}>
            <div
              className="category-header"
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => setOpenSlug(isOpen ? null : c.slug)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpenSlug(isOpen ? null : c.slug);
                }
              }}
            >
              <span className="cat-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="cat-text">
                <h2 className="cat-name">{c.name}</h2>
                {c.tagline && <span className="cat-tagline">{c.tagline}</span>}
              </div>
              <span className="cat-count">
                Explore {count} practice{count === 1 ? '' : 's'}
              </span>
              <span className="cat-toggle" aria-hidden="true">{isOpen ? '\u2212' : '+'}</span>
            </div>

            <div className="category-panel" style={{ maxHeight: isOpen ? '1600px' : 0 }}>
              <div className="panel-inner">
                <div className="panel-image">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" />
                  ) : (
                    <div className="panel-image-placeholder" aria-hidden="true" />
                  )}
                  <div className="panel-image-overlay" />
                  {c.tagline && <p className="panel-image-label">{c.tagline}</p>}
                </div>

                <div className="panel-content">
                  <p className="panel-content-eyebrow">{c.name}</p>
                  {c.description && (
                    <p className="panel-content-intro">{c.description}</p>
                  )}

                  {count > 0 && (
                    <div className="panel-tags">
                      {c.practices.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/wellness-experiences/${c.slug}/${p.slug}`}
                          className="sub-tag"
                        >
                          {p.name}
                          <span className="sub-tag-arrow" aria-hidden="true">&rarr;</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  <Link href={`/wellness-experiences/${c.slug}`} className="panel-explore-link">
                    Explore all {c.name.toLowerCase()} venues &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
