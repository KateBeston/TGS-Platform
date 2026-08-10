import Link from 'next/link';
import { placeOf, venueHref, type Card } from '@/lib/venues';

/* Price the way a listing reads it: currency-aware, no cents. */
function formatMoney(amount: number, currency: string | null): string {
  const cur = currency || 'AUD';
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${cur} ${amount}`;
  }
}

/* A listing card, four treatments.
 *
 * Lifted from tgs_venues_v2 rather than reinterpreted — the ladder is
 * Premium and Featured as horizontal splits with the image on the left,
 * Standard as a vertical card, Essentials as a row with a thumbnail.
 * Four genuinely different shapes, not four sizes of one shape.
 *
 * Two departures, both asked for. The tier is never named — a guest
 * reading "Essentials Listings" is being told which venue paid the least.
 * And every treatment carries a rating, including where there is none to
 * show, because a gap where a number should be reads as a fault. */

function Rating({ rating, count, size }: {
  rating: number | null; count: number; size: string;
}) {
  if (!rating) {
    return <span className={`${size}-card-rating none`}>Not yet reviewed</span>;
  }
  return (
    <span className={`${size}-card-rating`}>
      <span className="star" aria-hidden="true">&#9733;</span>{' '}
      {Number(rating).toFixed(1)}{' '}
      <span className="count">({count})</span>
    </span>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="card-tags">
      {tags.slice(0, 4).map((t) => <span key={t} className="card-tag">{t}</span>)}
    </div>
  );
}

function Eyebrow({ card }: { card: Card }) {
  return (
    <div className="card-eyebrow">
      <span className="type-primary">
        {card.marketplace === 'Wellness' ? 'Wellness Venue' : 'Retreat Venue'}
      </span>
      {card.venue_type && (
        <>
          <span className="eyebrow-divider">&middot;</span>
          <span className="type-secondary">{card.venue_type}</span>
        </>
      )}
    </div>
  );
}

export default function VenueCard({ card, size }: { card: Card; size: 1 | 2 | 3 | 4 }) {
  const href = venueHref(card);
  const blurb = card.listing_description ?? card.venue_short_description;
  const name = card.headline ?? card.venue_name;
  const tags = (card.tags ?? []) as string[];

  const image = (
    <div className={`${['premium','featured','standard','essentials'][size - 1]}-card-image`}>
      {card.image_url
        ? <img src={card.image_url} alt="" loading="lazy" />
        : <span className="placeholder-img">The Global Sanctum</span>}
    </div>
  );

  // Premium — image left at 46%, the editor's note, tags, and the whole
  // excerpt.
  if (size === 1) {
    return (
      <Link href={href} className="premium-card">
        {image}
        <div className="premium-card-body">
          <Eyebrow card={card} />
          <div className="premium-card-name">{name}</div>
          <div className="premium-card-location">{placeOf(card)}</div>
          {card.editor_note && (
            <div className="premium-card-editor-note">{card.editor_note}</div>
          )}
          {blurb && <p className="premium-card-excerpt">{blurb}</p>}
          <Tags tags={tags} />
          <div className="premium-card-meta">
            <Rating rating={card.rating} count={card.review_count} size="premium" />
            {card.price_from != null ? (
              <span className="premium-card-price">
                From <strong>{formatMoney(card.price_from, card.price_currency)}</strong>
                {card.price_unit ? ` / ${card.price_unit}` : ''}
              </span>
            ) : card.max_guests ? (
              <span className="premium-card-price">Sleeps <strong>{card.max_guests}</strong></span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  // Featured — the same shape, smaller, without the editor's note.
  if (size === 2) {
    return (
      <Link href={href} className="featured-card">
        {image}
        <div className="featured-card-body">
          <Eyebrow card={card} />
          <div className="featured-card-name">{name}</div>
          <div className="featured-card-location">{placeOf(card)}</div>
          {blurb && <p className="featured-card-excerpt">{blurb}</p>}
          <Tags tags={tags} />
          <div className="featured-card-meta">
            <Rating rating={card.rating} count={card.review_count} size="featured" />
            {card.price_from != null ? (
              <span className="featured-card-price">
                From <strong>{formatMoney(card.price_from, card.price_currency)}</strong>
                {card.price_unit ? ` / ${card.price_unit}` : ''}
              </span>
            ) : card.max_guests ? (
              <span className="featured-card-price">Sleeps <strong>{card.max_guests}</strong></span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  // Standard — vertical, image on top.
  if (size === 3) {
    return (
      <Link href={href} className="standard-card">
        {image}
        <div className="standard-card-body">
          <Eyebrow card={card} />
          <div className="standard-card-name">{name}</div>
          <div className="standard-card-location">{placeOf(card)}</div>
          {blurb && <p className="standard-card-excerpt">{blurb}</p>}
          <Tags tags={tags} />
          <div className="standard-card-meta">
            <Rating rating={card.rating} count={card.review_count} size="standard" />
            {card.price_from != null ? (
              <span className="standard-card-price">
                From <strong>{formatMoney(card.price_from, card.price_currency)}</strong>
                {card.price_unit ? ` / ${card.price_unit}` : ''}
              </span>
            ) : card.max_guests ? (
              <span className="standard-card-price">Sleeps <strong>{card.max_guests}</strong></span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  // Essentials — a row with a thumbnail. Modest rather than absent, which
  // is the difference between restrained and broken.
  return (
    <Link href={href} className="essentials-card">
      {image}
      <div className="essentials-card-body">
        <div className="essentials-card-eyebrow">
          {card.marketplace === 'Wellness' ? 'Wellness' : 'Retreat'}
        </div>
        <div className="essentials-card-name">{name}</div>
        <div className="essentials-card-location">{placeOf(card)}</div>
        <div className="essentials-card-meta">
          <Rating rating={card.rating} count={card.review_count} size="essentials" />
          {card.price_from != null && (
            <span className="essentials-card-price">
              From <strong>{formatMoney(card.price_from, card.price_currency)}</strong>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
