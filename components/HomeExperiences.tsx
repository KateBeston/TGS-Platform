/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

type Practice = { name: string; slug: string; venue_count: number | null };
type Cat = { name: string; slug: string; image: string | null; tagline: string; practices: Practice[] };

const GRAD = [
  '#3f4a52,#20272b', '#4a5348,#232a24', '#524a5a,#26222b', '#5a4e3a,#2b2519',
  '#464a3f,#22251d', '#3f3a4a,#201d26', '#4a4a52,#232326', '#54473f,#26201c',
  '#4a5240,#232a20', '#3f4a44,#1f2622', '#4a3f4a,#241f24', '#3a4652,#1c2229',
  '#54464a,#262023', '#4a4a3f,#23231d', '#3f4a52,#20272b',
];

// Home-page wellness experiences: a horizontal rail of category covers, each
// linking to its category page, with a few practice chips that jump straight
// to the practice. "Explore all" (in the section header) goes to the index.
export default function HomeExperiences({ categories }: { categories: Cat[] }) {
  if (!categories.length) return null;
  return (
    <div className="hx-track">
      {categories.map((c, i) => (
        <div key={c.slug} className="hx-item">
          <Link
            href={`/wellness-experiences/${c.slug}`}
            className="hx-cover"
            style={{ background: `linear-gradient(150deg,${GRAD[i % GRAD.length]})` }}
          >
            {c.image ? <img src={c.image} alt="" loading="lazy" /> : null}
            <div className="hx-cover-ov" />
            <div className="hx-cover-body">
              <h3 className="hx-cover-name">{c.name}</h3>
              {c.tagline ? <p className="hx-cover-tag">{c.tagline}</p> : null}
            </div>
          </Link>
          {c.practices.length > 0 && (
            <div className="hx-chips">
              {c.practices.slice(0, 3).map((p) => (
                <Link key={p.slug} href={`/wellness-experiences/${c.slug}/${p.slug}`} className="hx-chip">
                  {p.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
