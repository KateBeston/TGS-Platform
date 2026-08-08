import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import VenueTabs from '@/components/VenueTabs';
import VenueEnquiry from '@/components/VenueEnquiry';
import { duration, loadVenue, marketplaceOf, money } from '@/lib/venue';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ marketplace: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { marketplace, slug } = await params;
  const v = await loadVenue(marketplace, slug);
  if (!v) return { title: 'Not found' };

  const place = [v.city, v.country].filter(Boolean).join(', ');

  // Its own title, description, canonical and image. At six thousand
  // venues that is six thousand pages each able to rank for its own name,
  // place and modality mix — which is the point of a page per venue.
  return {
    title: `${v.headline ?? v.venue_name}${place ? ` — ${place}` : ''}`,
    description: v.listing_description ?? v.venue_short_description ?? undefined,
    alternates: { canonical: `/${marketplace}/${slug}` },
    openGraph: {
      title: v.headline ?? v.venue_name,
      description: v.listing_description ?? v.venue_short_description ?? undefined,
      images: v.image_url ? [v.image_url] : undefined,
      type: 'website',
    },
  };
}

function Panel({ id, children }: { id: string; children: React.ReactNode }) {
  // Rendered into the HTML and hidden by the tabs, not mounted on click.
  // A panel that only exists after JavaScript runs is a panel a crawler
  // never sees — seven eighths of the page, invisible.
  return <section id={`panel-${id}`} className="vpanel">{children}</section>;
}

export default async function VenuePage({ params }: Params) {
  const { marketplace, slug } = await params;
  const v = await loadVenue(marketplace, slug);
  if (!v) notFound();

  const isRetreat = marketplaceOf(marketplace) === 'Retreat';

  const immediate = v.settings.filter((s: any) => s.relation === 'Immediate');
  const reachable = v.settings.filter((s: any) => s.relation === 'Reachable');

  const place = [v.what_they_call_it ?? v.locality, v.city, v.country]
    .filter(Boolean).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i)
    .join(', ');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'spaces', label: isRetreat ? 'Spaces' : 'The space', count: v.spaces.length },
    { id: 'stay', label: 'Stay', count: v.rooms.length },
    { id: 'offered', label: isRetreat ? 'Experiences' : 'Services', count: v.services.length },
    { id: 'facilities', label: 'Facilities', count: v.facilities.length },
    { id: 'location', label: 'Location' },
    { id: 'reviews', label: 'Reviews', count: v.reviews.length },
    { id: 'enquire', label: 'Enquire' },
  ].filter((t) => t.count === undefined || t.count > 0
             || ['overview', 'location', 'enquire'].includes(t.id));

  // Structured data, so the page can be understood as a business rather
  // than as prose. Address is deliberately absent — the street is not
  // public and the locality is enough to place it.
  const structured = {
    '@context': 'https://schema.org',
    '@type': isRetreat ? 'LodgingBusiness' : 'HealthAndBeautyBusiness',
    name: v.venue_name,
    description: v.listing_description ?? v.venue_short_description,
    image: v.image_url ?? undefined,
    url: `https://www.theglobalsanctum.com/${marketplace}/${slug}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: v.city ?? undefined,
      addressRegion: v.state ?? undefined,
      addressCountry: v.country ?? undefined,
    },
    geo: v.latitude ? {
      '@type': 'GeoCoordinates',
      latitude: v.latitude, longitude: v.longitude,
    } : undefined,
    aggregateRating: v.rating ? {
      '@type': 'AggregateRating',
      ratingValue: v.rating, reviewCount: v.review_count,
      bestRating: 5, worstRating: 1,
    } : undefined,
    makesOffer: v.services.slice(0, 20).map((s: any) => ({
      '@type': 'Offer',
      name: s.name,
      price: s.base_price ?? undefined,
      priceCurrency: s.currency ?? undefined,
    })),
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />

      <section className="vhead">
        <div className="wrap">
          <div className="tb-crumb">
            <Link href="/venues">Venues</Link>
            {v.country && <> · <Link href={`/venues?country=${v.country_slug}`}>{v.country}</Link></>}
          </div>

          <div className="eyebrow" style={{ marginTop: 'var(--s4)' }}>{v.venue_type}</div>
          <h1>{v.headline ?? v.venue_name}</h1>
          <p className="vhead-place">{place}</p>

          <div className="vhead-facts">
            {v.rating && (
              <span><span className="star">&#9733;</span> {Number(v.rating).toFixed(1)}
                <span className="muted"> · {v.review_count} reviews</span></span>
            )}
            {v.max_guests && <span>Sleeps {v.max_guests}</span>}
            {v.total_bedrooms && <span>{v.total_bedrooms} bedrooms</span>}
            {!!v.spaces.length && (
              <span>{v.spaces.length} space{v.spaces.length === 1 ? '' : 's'}</span>
            )}
          </div>
        </div>
      </section>

      {v.image_url && (
        <div className="vhero">
          <img src={v.image_url} alt={v.venue_name} />
        </div>
      )}

      <div className="wrap">
        <VenueTabs tabs={tabs} />

        <Panel id="overview">
          <div className="vprose">
            <p className="vlead">{v.listing_description ?? v.venue_short_description}</p>
            {v.venue_full_description && <p>{v.venue_full_description}</p>}
            {v.setting_description && (
              <>
                {v.setting_headline && <h2>{v.setting_headline}</h2>}
                <p>{v.setting_description}</p>
              </>
            )}
          </div>

          {!!immediate.length && (
            <div className="pills">
              {immediate.map((s: any) => (
                <span key={s.setting_id} className="pill">
                  {s.name}{s.detail ? <span className="pill-note"> · {s.detail}</span> : null}
                </span>
              ))}
            </div>
          )}

          {!!v.categories.length && (
            <>
              <h2 className="vsub">What happens here</h2>
              <div className="pills">
                {v.categories.map((c: any) => (
                  <span key={c.category_id} className={`pill ${c.is_primary ? 'pill-gold' : ''}`}>
                    {c.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel id="spaces">
          <h2 className="vsub">
            {isRetreat ? 'Spaces that hold whatever you bring' : 'The space'}
          </h2>
          <div className="vlist">
            {v.spaces.map((s: any) => (
              <article key={s.id} className="vrow">
                <div>
                  <h3>{s.name}</h3>
                  <div className="vrow-meta">
                    {[s.space_type,
                      s.capacity ? `Holds ${s.capacity}` : null,
                      s.area ? `${s.area} ${s.area_unit ?? 'sqm'}` : null,
                      s.is_outdoor ? 'Outdoor' : null,
                      s.step_free_access ? 'Step-free' : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {s.description && <p>{s.description}</p>}
                  {!!s.equipment_provided?.length && (
                    <div className="vrow-note">
                      Provided: {s.equipment_provided.join(', ')}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel id="stay">
          <h2 className="vsub">Stay with us</h2>
          <div className="vlist">
            {v.rooms.map((r: any) => (
              <article key={r.id} className="vrow">
                <div>
                  <h3>{r.name}</h3>
                  <div className="vrow-meta">
                    {[r.quantity ? `${r.quantity} available` : null,
                      r.sleeps ? `Sleeps ${r.sleeps}` : null,
                      r.bed_configuration,
                      r.bathroom_type,
                      r.room_size ? `${r.room_size} ${r.room_size_unit ?? 'sqm'}` : null,
                      r.is_accessible ? 'Accessible' : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {r.description && <p>{r.description}</p>}
                  {!!r.room_amenities?.length && (
                    <div className="vrow-note">{r.room_amenities.join(' · ')}</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel id="offered">
          <h2 className="vsub">
            {isRetreat ? 'Enhance your retreat' : 'What is offered'}
          </h2>
          <div className="vlist">
            {v.services.map((s: any) => (
              <article key={s.id} className="vrow vrow-service">
                <div>
                  <h3>{s.name}</h3>
                  <div className="vrow-meta">
                    {[s.category, duration(s.duration_minutes),
                      s.couples_available ? 'Available for two' : null,
                      s.available_in_room ? 'Available in your room' : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {s.description && <p>{s.description}</p>}
                </div>
                <div className="vrow-price">
                  {s.price_is_from && <span className="from">from</span>}
                  {money(s.base_price, s.currency)}
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel id="facilities">
          <h2 className="vsub">Facilities</h2>
          <div className="vfacilities">
            {v.facilities.map((f: any) => (
              <div key={f.facility_id} className="vfacility">
                <span className="vfacility-name">{f.name}</span>
                {f.detail && <span className="vfacility-detail">{f.detail}</span>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel id="location">
          <h2 className="vsub">{v.location_tagline ?? 'Where it is'}</h2>
          <p className="vlead">{place}</p>

          {!!immediate.length && (
            <>
              <h3 className="vsub-small">The setting</h3>
              <div className="vlist-tight">
                {immediate.map((s: any) => (
                  <div key={s.setting_id} className="vrow-line">
                    <strong>{s.name}</strong>
                    {s.detail && <span> — {s.detail}</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Said separately, because "beachfront" and "twenty minutes
              from a beach" are different claims and running them together
              is how a listing overstates itself. */}
          {!!reachable.length && (
            <>
              <h3 className="vsub-small">Nearby</h3>
              <div className="vlist-tight">
                {reachable.map((s: any) => (
                  <div key={s.setting_id} className="vrow-line">
                    <strong>{s.detail ?? s.name}</strong>
                    {s.travel_minutes && (
                      <span> — {s.travel_minutes} minutes
                        {s.travel_mode ? ` by ${s.travel_mode.toLowerCase()}` : ''}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {v.climate_intro && (
            <>
              <h3 className="vsub-small">Climate</h3>
              <p>{v.climate_intro}</p>
            </>
          )}
        </Panel>

        <Panel id="reviews">
          <h2 className="vsub">
            {v.rating
              ? <>Reviews — {Number(v.rating).toFixed(1)} from {v.review_count}</>
              : 'Reviews'}
          </h2>

          {!v.reviews.length ? (
            <p className="muted">
              No reviews yet. We publish only reviews from people who actually
              stayed, which means a new venue has none for a while.
            </p>
          ) : (
            <div className="vlist">
              {v.reviews.map((r: any) => (
                <article key={r.id} className="vreview">
                  <div className="vreview-top">
                    <div>
                      <strong>{r.reviewer_name}</strong>
                      {r.reviewer_context && (
                        <span className="muted"> · {r.reviewer_context}</span>
                      )}
                    </div>
                    <span className="card-rating">
                      <span className="star">&#9733;</span>
                      {Number(r.rating_overall).toFixed(1)}
                    </span>
                  </div>
                  {r.title && <h3>{r.title}</h3>}
                  <p>{r.body}</p>
                  {r.is_verified && (
                    <div className="vreview-verified">
                      Verified &mdash; they booked through us
                    </div>
                  )}
                  {r.response_body && (
                    <div className="vreview-response">
                      <strong>{v.venue_name} replied</strong>
                      <p>{r.response_body}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel id="enquire">
          <VenueEnquiry venueId={v.id} venueName={v.venue_name}
                        marketplace={marketplaceOf(marketplace) ?? 'Retreat'} />
        </Panel>
      </div>
    </>
  );
}
