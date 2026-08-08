import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Page not found',
  // Not indexed. A 404 that ranks is a 404 somebody arrives at from a
  // search, which is worse than the original broken link.
  robots: { index: false, follow: true },
};

/* Not found.
 *
 * Most 404s here will be a venue that was archived, a practice with no
 * page yet, or an old URL from the previous site — and in all three
 * cases the person wanted something specific rather than the home page.
 * So this offers the places they were probably heading, and a way to ask
 * us directly.
 *
 * The venues shown are real ones where there are any, so the page is
 * useful rather than decorative. */

/* Suggestions, where they can be had.
 *
 * not-found.tsx is built once as a static page and cannot be forced
 * dynamic, so this runs at build time and must survive the database
 * being unreachable — which it is during a build with no environment.
 *
 * A 404 that throws is worse than no 404: the visitor gets a server
 * error instead of a page telling them where to go. */
async function suggestions() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('venue_cards')
      .select('id, venue_name, headline, listing_slug, marketplace, city, country, image_url')
      .order('tier_order').limit(3);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function NotFound() {
  const venues = await suggestions();

  return (
    <div className="wrap notfound">
      <div className="eyebrow">404</div>
      <h1>That page is not here</h1>
      <p className="notfound-sub">
        It may have moved, or the venue may no longer be listed. Nothing is lost
        &mdash; here is where most people are heading.
      </p>

      <div className="notfound-links">
        <Link className="btn-solid" href="/venues">Explore the venues</Link>
        <Link className="btn-line" href="/wellness-experiences">
          Browse by practice
        </Link>
        <Link className="btn-line" href="/contact">Ask us directly</Link>
      </div>

      {!!venues.length && (
        <section className="notfound-venues">
          <h2>Somewhere to start</h2>
          <div className="edit-grid">
            {venues.map((v: any) => (
              <Link key={v.id} className="edit-card"
                href={`/${v.marketplace === 'Wellness' ? 'wellness-venues' : 'retreat-venues'}`
                    + `/${v.listing_slug}`}>
                {v.image_url && (
                  <div className="edit-card-image">
                    <img src={v.image_url} alt="" loading="lazy" />
                  </div>
                )}
                <div className="edit-card-body">
                  <h3 className="edit-card-title">{v.headline ?? v.venue_name}</h3>
                  <div className="edit-meta">
                    <span>{[v.city, v.country].filter(Boolean).join(', ')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="notfound-foot">
        If you followed a link from somewhere and it should have worked, tell us
        at <a href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>{' '}
        and we will fix it.
      </p>
    </div>
  );
}
