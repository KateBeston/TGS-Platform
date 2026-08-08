import Link from 'next/link';
import { venueCards } from '@/lib/venues';

export const dynamic = 'force-dynamic';

/* Deliberately spare.
 *
 * The home page is being redesigned, so building it from the old mockup
 * would be work thrown away. This is enough to open a door to the venues
 * and no more — everything it does is something the redesign will
 * replace anyway. */
export default async function Home() {
  const { cards } = await venueCards({});
  const countries = new Set(cards.map((c) => c.country).filter(Boolean));

  return (
    <>
      <section className="hero-simple">
        <div className="wrap">
          <div className="eyebrow">The Global Sanctum</div>
          <h1>Thoughtfully curated.<br />Globally connected.</h1>
          <p className="page-sub">
            Retreat centres, wellness resorts, thermal sanctuaries and sacred
            spaces &mdash; found, visited and vouched for.
          </p>

          <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap',
                        marginTop: 'var(--s5)' }}>
            <Link className="btn-solid" href="/venues">Explore the venues</Link>
            <Link className="btn-line" href="/venues?marketplace=Retreat">
              I am looking for a retreat venue
            </Link>
          </div>

          {!!cards.length && (
            <p style={{ marginTop: 'var(--s5)', fontSize: 13.5,
                        color: 'var(--muted)' }}>
              {cards.length} venue{cards.length === 1 ? '' : 's'} across{' '}
              {countries.size} countr{countries.size === 1 ? 'y' : 'ies'}, and growing.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
