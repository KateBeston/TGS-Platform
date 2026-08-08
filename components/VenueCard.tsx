import Link from 'next/link';
import { placeOf, venueHref, type Card } from '@/lib/venues';

/* A listing card.
 *
 * Four treatments by tier. The tier is never named — a guest reading
 * "Essentials Listings" is being told which venue paid the least, which
 * is unflattering to the venue and useless to them. What they see is a
 * hierarchy; what the venue gets is position and size.
 *
 * Every tier carries a photo and a rating. The mockup gave Essentials
 * neither, which reads as broken rather than modest. */

function Rating({ rating, count }: { rating: number | null; count: number }) {
  if (!rating) {
    // Said rather than left blank. A gap where a number should be looks
    // like a fault; "not yet reviewed" is a fact.
    return <span className="card-rating card-rating-none">Not yet reviewed</span>;
  }
  return (
    <span className="card-rating">
      <span className="star" aria-hidden="true">&#9733;</span>
      {Number(rating).toFixed(1)}
      <span className="card-rating-count">
        {count} review{count === 1 ? '' : 's'}
      </span>
    </span>
  );
}

export default function VenueCard({ card, size }: { card: Card; size: 1 | 2 | 3 | 4 }) {
  const href = venueHref(card);
  const blurb = card.listing_description ?? card.venue_short_description;

  return (
    <article className={`vcard vcard-${size}`}>
      <Link href={href} className="vcard-image" aria-hidden="true" tabIndex={-1}>
        {card.image_url
          ? <img src={card.image_url} alt="" loading="lazy" />
          : <span className="vcard-image-none" />}
      </Link>

      <div className="vcard-body">
        <div className="vcard-kind">
          {card.venue_type ?? (card.marketplace === 'Wellness'
            ? 'Wellness venue' : 'Retreat venue')}
        </div>

        <h3 className="vcard-name">
          <Link href={href}>{card.headline ?? card.venue_name}</Link>
        </h3>

        <div className="vcard-place">{placeOf(card)}</div>

        {size <= 3 && blurb && (
          <p className="vcard-blurb">{blurb}</p>
        )}

        <div className="vcard-foot">
          <Rating rating={card.rating} count={card.review_count} />
          {card.max_guests && (
            <span className="vcard-capacity">Sleeps {card.max_guests}</span>
          )}
        </div>
      </div>
    </article>
  );
}
