/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

type Practice = { name: string; slug: string; venue_count: number | null };
type Cat = { name: string; slug: string; image: string | null; tagline: string; practices: Practice[] };

const GRAD = [
  '#3f4a52,#20272b', '#4a5348,#232a24', '#524a5a,#26222b', '#5a4e3a,#2b2519', '#464a3f,#22251d',
];

// A handful of wellness experience categories in the destinations-style mosaic
// (one large feature tile, four smaller). Each links to its category page;
// "explore all" (in the section) goes to the full index.
export default function HomeExperiences({ categories }: { categories: Cat[] }) {
  const items = categories.slice(0, 5);
  if (!items.length) return null;
  return (
    <div className="hx-grid">
      {items.map((c, i) => (
        <Link
          key={c.slug}
          href={`/wellness-experiences/${c.slug}`}
          className={`hx-tile ${i === 0 ? 'hx-tile-large' : ''}`}
          style={{ background: `linear-gradient(150deg,${GRAD[i % GRAD.length]})` }}
        >
          {c.image ? <img src={c.image} alt="" loading="lazy" /> : null}
          <div className="hx-tile-ov" />
          <div className="hx-tile-body">
            <div className="hx-tile-name">{c.name}</div>
            {c.tagline ? <div className="hx-tile-tag">{c.tagline}</div> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
