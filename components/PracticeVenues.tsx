'use client';

import Link from 'next/link';
import { useState } from 'react';

/* The venue grid for a practice page — the product. Venues are those
 * tagged with the practice in the portal; each card redirects through to
 * the venue's own detail page. Location filter is client-side. Location
 * string and venue href are computed on the server and passed in, so this
 * client component pulls in no server-only modules. */

type V = {
  id: number;
  venue_name: string;
  headline?: string | null;
  marketplace?: string | null;
  venue_type?: string | null;
  image_url?: string | null;
  country?: string | null;
  rating?: number | null;
  review_count?: number;
  tier_slug?: string | null;
  place: string;
  href: string;
  service?: {
    service_name?: string | null;
    service_duration_minutes?: number | null;
    service_price?: number | null;
    service_price_currency?: string | null;
    service_description?: string | null;
  } | null;
};

function money(amount: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency', currency: currency || 'AUD', maximumFractionDigits: 0,
    }).format(amount);
  } catch { return `$${amount}`; }
}

export default function PracticeVenues(
  { venues, practiceName }: { venues: V[]; practiceName: string },
) {
  const countries = [...new Set(venues.map((v) => v.country).filter(Boolean))] as string[];
  const [loc, setLoc] = useState<string | null>(null);
  const shown = loc ? venues.filter((v) => v.country === loc) : venues;

  return (
    <section className="venues">
      <div className="wrap">
        <div className="vh">
          <h2>Venues offering <em>{practiceName}</em></h2>
          <span className="count">
            {venues.length} venue{venues.length === 1 ? '' : 's'}
          </span>
          <div className="rule" />
        </div>

        {countries.length > 1 && (
          <div className="filters">
            <button
              type="button"
              className={loc === null ? 'on' : ''}
              onClick={() => setLoc(null)}
            >
              All locations
            </button>
            {countries.map((cty) => (
              <button
                key={cty}
                type="button"
                className={loc === cty ? 'on' : ''}
                onClick={() => setLoc(cty)}
              >
                {cty}
              </button>
            ))}
          </div>
        )}

        {shown.length ? (
          <div className="grid">
            {shown.map((v) => (
              <article key={v.id} className="card">
                <div className="card-img">
                  {v.tier_slug === 'premium' && <span className="badge">Featured</span>}
                  {v.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.image_url} alt="" loading="lazy" />
                  ) : (
                    <span className="ph">Venue image</span>
                  )}
                </div>
                <div className="card-b">
                  <p className="card-type">
                    {v.marketplace === 'Wellness' ? 'Wellness Venue' : 'Retreat Venue'}
                    {v.venue_type ? ` \u00b7 ${v.venue_type}` : ''}
                  </p>
                  <h3>{v.headline ?? v.venue_name}</h3>
                  <p className="card-loc">{v.place}</p>
                  {v.service?.service_name && (
                    <div className="svc">
                      <div className="svc-top">
                        <span className="svc-name">{v.service.service_name}</span>
                        {(v.service.service_duration_minutes || v.service.service_price != null) && (
                          <span className="svc-meta">
                            {[
                              v.service.service_duration_minutes ? `${v.service.service_duration_minutes} min` : null,
                              v.service.service_price != null ? money(v.service.service_price, v.service.service_price_currency) : null,
                            ].filter(Boolean).join(' \u00b7 ')}
                          </span>
                        )}
                      </div>
                      {v.service.service_description && <p>{v.service.service_description}</p>}
                    </div>
                  )}
                  <div className="card-foot">
                    <span className="rating">
                      {v.rating != null
                        ? <><b>{v.rating}</b> &middot; {v.review_count} review{v.review_count === 1 ? '' : 's'}</>
                        : 'New to the collection'}
                    </span>
                    <Link className="card-cta" href={v.href}>View venue &rarr;</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="pr-empty">
            No venues offering this in the collection yet. New spaces are added as
            they join.
          </p>
        )}
      </div>
    </section>
  );
}
