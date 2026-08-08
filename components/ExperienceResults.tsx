import Link from 'next/link';
import { placeOf, venueHref, type Card } from '@/lib/venues';

/* The result cards on a hub page.
 *
 * Smaller than the listing cards and carrying the practices instead of a
 * description — somebody on a Sound Bath page has already said what they
 * want, and what they need next is which other practices sit alongside
 * it at that venue. */

export default function ExperienceResults({
  venues, practices, highlight,
}: {
  venues: Card[];
  practices: Map<number, string[]>;
  highlight?: string;
}) {
  if (!venues.length) {
    return (
      <div className="empty">
        <h2>No venues here yet</h2>
        <p>
          We are still finding them. Tell us what you are after and we will look
          properly &mdash; including places not yet on the platform.
        </p>
        <Link className="btn-solid" href="/contact">Tell us what you need</Link>
      </div>
    );
  }

  return (
    <div className="venue-results-grid">
      {venues.map((v) => {
        const mine = practices.get(v.id) ?? [];
        // The one they came for first, then the rest.
        const ordered = highlight
          ? [...mine].sort((a, b) =>
              (b === highlight ? 1 : 0) - (a === highlight ? 1 : 0))
          : mine;

        return (
          <Link key={v.id} href={venueHref(v)} className="result-card">
            <div className="result-card-image">
              {v.image_url
                ? <img src={v.image_url} alt="" loading="lazy" />
                : <span className="placeholder-img">The Global Sanctum</span>}
              {v.country && <span className="result-card-country">{v.country}</span>}
            </div>
            <div className="result-card-body">
              <div className="result-card-location">{placeOf(v)}</div>
              <h3 className="result-card-name">{v.headline ?? v.venue_name}</h3>

              {!!ordered.length && (
                <div className="result-card-practices">
                  {ordered.slice(0, 4).map((p) => (
                    <span key={p}
                      className={`result-card-pill ${p === highlight ? 'is-on' : ''}`}>
                      {p}
                    </span>
                  ))}
                  {ordered.length > 4 && (
                    <span className="result-card-pill quiet">
                      and {ordered.length - 4} more
                    </span>
                  )}
                </div>
              )}

              <div className="result-card-meta">
                {v.max_guests && (
                  <span className="result-card-meta-item">Sleeps {v.max_guests}</span>
                )}
                {v.rating ? (
                  <span className="result-card-meta-item">
                    <span className="star">&#9733;</span> {Number(v.rating).toFixed(1)}
                  </span>
                ) : (
                  <span className="result-card-meta-item">Not yet reviewed</span>
                )}
              </div>

              <span className="result-card-cta">See the venue &rarr;</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
