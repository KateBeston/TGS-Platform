'use client';

/* eslint-disable @next/next/no-img-element */
import { Fragment, useEffect, useRef, useState } from 'react';

type Practice = { name: string; slug: string; venue_count: number | null };
type Cat = {
  name: string;
  slug: string;
  image: string | null;
  tagline: string;
  practices: Practice[];
};

const GRAD = [
  '#3f4a52,#20272b', '#4a5348,#232a24', '#3f4a52,#20272b', '#524a5a,#26222b',
  '#5a4e3a,#2b2519', '#464a3f,#22251d', '#3f3a4a,#201d26', '#4a4a52,#232326',
  '#54473f,#26201c', '#4a5240,#232a20', '#3f4a44,#1f2622', '#4a3f4a,#241f24',
  '#3a4652,#1c2229', '#54464a,#262023', '#4a4a3f,#23231d',
];

export default function ExperienceGrid({ categories }: { categories: Cat[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [cols, setCols] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.wx-ec'));
      if (!cards.length) return;
      const t0 = cards[0].offsetTop;
      setCols(cards.filter((c) => c.offsetTop === t0).length || 1);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, categories.length]);

  const openIndex = open ? categories.findIndex((c) => c.slug === open) : -1;
  const lastInRow =
    openIndex >= 0
      ? Math.min(Math.floor(openIndex / cols) * cols + cols - 1, categories.length - 1)
      : -1;
  const openCat = openIndex >= 0 ? categories[openIndex] : null;

  return (
    <section className="wx-wrap">
      <div className="wx-cards" ref={gridRef}>
        {categories.map((c, i) => (
          <Fragment key={c.slug}>
            <article
              className={`wx-ec${open === c.slug ? ' wx-ec--active' : ''}`}
              style={{ background: `linear-gradient(150deg,${GRAD[i % GRAD.length]})` }}
            >
              {c.image ? <img className="wx-ec-img" src={c.image} alt="" /> : null}
              <div className="wx-ec-ov" />
              <a
                className="wx-ec-cardlink"
                href={`/wellness-experiences/${c.slug}`}
                aria-label={`Explore ${c.name}`}
              />
              <span className="wx-ec-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="wx-ec-c">
                <h3 className="wx-ec-name">
                  <a className="wx-ec-namelink" href={`/wellness-experiences/${c.slug}`}>{c.name}</a>
                </h3>
                {c.tagline ? <p className="wx-ec-tag">{c.tagline}</p> : null}
                <div className="wx-ec-rule" />
                <div className="wx-ec-chips">
                  {c.practices.slice(0, 3).map((p) => (
                    <a
                      key={p.slug}
                      className="wx-ec-chip"
                      href={`/wellness-experiences/${c.slug}/${p.slug}`}
                    >
                      {p.name}
                    </a>
                  ))}
                  {c.practices.length > 3 ? (
                    <button
                      type="button"
                      className="wx-ec-chip wx-ec-chip-more"
                      onClick={() => setOpen(open === c.slug ? null : c.slug)}
                    >
                      {open === c.slug ? 'Close' : `+${c.practices.length - 3} more`}
                    </button>
                  ) : null}
                </div>
                <a className="wx-ec-cta" href={`/wellness-experiences/${c.slug}`}>
                  Explore {c.name} <span className="wx-ar">→</span>
                </a>
              </div>
            </article>

            {open && i === lastInRow && openCat ? (
              <div className="wx-panel">
                <div className="wx-panel-head">
                  <div>
                    <div className="wx-panel-eyebrow">Wellness Experiences</div>
                    <h3 className="wx-panel-title">{openCat.name}</h3>
                    {openCat.tagline ? <p className="wx-panel-intro">{openCat.tagline}</p> : null}
                  </div>
                  <button type="button" className="wx-panel-close" onClick={() => setOpen(null)}>
                    Close ✕
                  </button>
                </div>
                <p className="wx-panel-note">
                  Every practice in this category. Jump straight to any of them.
                </p>
                <div className="wx-practices">
                  {openCat.practices.map((p) => (
                    <a
                      key={p.slug}
                      className="wx-practice"
                      href={`/wellness-experiences/${openCat.slug}/${p.slug}`}
                    >
                      {p.name}
                      {(p.venue_count ?? 0) > 0 ? <span className="wx-vc">{p.venue_count}</span> : null}{' '}
                      <span className="wx-ar">→</span>
                    </a>
                  ))}
                </div>
                <div className="wx-panel-foot">
                  <a href={`/wellness-experiences/${openCat.slug}`}>
                    Explore the full {openCat.name} page →
                  </a>
                </div>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
