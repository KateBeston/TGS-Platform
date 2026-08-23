import Link from 'next/link';
import { notFound } from 'next/navigation';
import { styleBySlug, venuesForStyle, retreatStyles } from '@/lib/retreatStyles';
import VenueGrid from '@/components/VenueGrid';

export default async function RetreatStyleCategory({ slug }: { slug: string }) {
  const style = await styleBySlug(slug);
  if (!style) notFound();
  const [venues, all] = await Promise.all([venuesForStyle(style.id), retreatStyles()]);
  const related = all.filter((s) => s.slug !== style.slug).slice(0, 8);
  const headline = style.h1 || `Retreat venues for ${style.name.toLowerCase()}`;
  const intro = style.intro || style.description;

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb"><Link href="/retreat-venues">Retreat venues</Link></div>
          <h1 style={{ marginTop: 'var(--s4)' }}>{headline}</h1>
          {intro && <p className="page-sub">{intro}</p>}
          <p className="page-sub" style={{ fontSize: 15, marginTop: 'var(--s3)' }}>
            {venues.length} venue{venues.length === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      <div className="wrap cat-body">
        {venues.length > 0
          ? <VenueGrid cards={venues} />
          : <p className="page-sub">We&rsquo;re curating venues for this style. Explore other styles below in the meantime.</p>}
      </div>

      {related.length > 0 && (
        <section className="cat-related">
          <div className="wrap">
            <h3>More styles to explore</h3>
            <div className="cat-pills">
              {related.map((r) => (
                <Link key={r.id} href={`/retreat-venues/style/${r.slug}`}>{r.name}</Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
