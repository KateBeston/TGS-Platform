import Link from 'next/link';
import VenueTabs from '@/components/VenueTabs';
import VenueMap from './VenueMap';
import { BookingCart, AddToCart } from './BookingCart';
import { FavouriteButton } from '@/components/SavedVenues';
import { ImageCarousel } from './ImageCarousel';
import VenueEnquiry from '@/components/VenueEnquiry';
import VenueCard from '@/components/VenueCard';
import {
  Accessibility, ExperienceBlock, Glance, HostBlock, InEveryRoom, OpeningHours,
  PackagesPanel, PoliciesPanel, RoomGrid, Section, TabHero, VenueLinks,
} from './Section';
import { duration, money } from '@/lib/venue';

/* A space's attribute tags, built from the structured record — capacity,
 * size, floor, whether it is outdoors, and what it suits. The mockup's
 * feature-block carries these as pills beneath the copy. */
function fmtArea(area: any, unit: string | null): string | null {
  if (!area) return null;
  const u = unit ?? 'sqm';
  return u === 'sqm' ? `${area}m²` : `${area} ${u}`;
}

function spaceTags(s: any): string[] {
  return [
    s.capacity ? `Holds ${s.capacity}` : null,
    fmtArea(s.area, s.area_unit),
    s.flooring || null,
    s.is_outdoor ? 'Outdoor' : s.is_covered ? 'Covered' : null,
    ...((s.suitable_for ?? []) as string[]),
  ].filter(Boolean) as string[];
}

/* The image half of a feature-block. A space carries its own photo once
 * one is uploaded; until then it degrades to the house placeholder rather
 * than borrowing the venue hero, which would repeat one image down the
 * whole tab. */
function SpaceImage({ s }: { s: any }) {
  return (
    <div className="feature-image">
      {s.image_url
        ? <img src={s.image_url} alt={s.name} loading="lazy" />
        : <span className="placeholder-img">The Global Sanctum</span>}
    </div>
  );
}

/* The retreat venue template.
 *
 * A retreat host is deciding whether their group fits and whether the
 * spaces will hold what they run. So: spaces first, then accommodation,
 * then what the property adds, then where it is.
 *
 * Deliberately not the wellness template. A host booking a shala for
 * eighteen and a guest booking a facial are answering different
 * questions, and one page pretending to serve both serves neither. */

export default function RetreatVenue({ v }: { v: Record<string, any> }) {
  const immediate = v.settings.filter((s: any) => s.relation === 'Immediate');
  const reachable = v.settings.filter((s: any) => s.relation === 'Reachable');

  const place = [v.what_they_call_it ?? v.locality, v.city, v.country]
    .filter(Boolean).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i)
    .join(', ');

  const practice = v.spaces.filter((s: any) => s.space_type === 'Practice space');
  const featured = practice[0] ?? v.spaces[0];
  const rest = v.spaces.filter((s: any) => s.id !== featured?.id);

  const byCategory = v.facilities.reduce((acc: Record<string, any[]>, f: any) => {
    const k = f.category ?? 'Other';
    (acc[k] ??= []).push(f);
    return acc;
  }, {});

  const hasBring = !!(v.please_bring?.length || v.optional_to_bring?.length);
  const tabs = [
    { id: 'overview', label: 'Overview' },
    v.spaces.length && { id: 'spaces', label: 'Spaces' },
    v.rooms.length && { id: 'stay', label: 'Accommodation' },
    (v.facilities.length || v.wifi_coverage || v.wifi_details || v.mobile_coverage || v.mobile_coverage_notes) && { id: 'amenities', label: 'Amenities' },
    (v.services.length || v.excursions.length || v.extras?.length) && { id: 'experiences', label: 'Experiences' },
    v.packages.length && { id: 'packages', label: 'Packages' },
    { id: 'location', label: 'Location' },
    (v.policies.length || v.faqs.length || v.cultural_protocol_details || hasBring) && { id: 'policies', label: 'Good to know' },
    v.reviews.length && { id: 'reviews', label: 'Reviews' },
    { id: 'enquire', label: 'Enquire' },
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <>
      <ImageCarousel
        images={[v.image_url, ...(v.image_urls ?? [])].filter(
          (s: string | null, i: number, a: (string | null)[]): s is string => !!s && a.indexOf(s) === i)}
        alt={v.venue_name}
        variant="hero"
      >
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">{v.venue_type}</div>
          <h1 className="hero-venue-name">{v.headline ?? v.venue_name}</h1>
          <div className="hero-location">{place}</div>
          <div className="hero-save"><FavouriteButton venueId={v.id} variant="hero" /> Save</div>
        </div>
      </ImageCarousel>

      <BookingCart rooms={v.rooms} services={v.services} extras={v.extras} ratePlans={v.rate_plans} currency={v.price_currency} venueName={v.venue_name} location={[v.city, v.country].filter(Boolean).join(", ")}>
      <VenueTabs tabs={tabs} venueName={v.venue_name} location={v.city ?? v.country ?? ''} />

      {/* ── overview ───────────────────────────────────────────────── */}

      <div id="panel-overview" className="vpanel">
        {v.promotions?.length > 0 && (
          <Section tone="cream" label="Special" title="Exclusive rates available">
            <div className="promo-list">
              {v.promotions.map((p: any) => (
                <div key={p.id} className="promo-item">
                  <div className="promo-head">
                    {p.badge_label && <span className="promo-badge">{p.badge_label}</span>}
                    <span className="promo-title">{p.title}</span>
                  </div>
                  {p.description && <p className="promo-desc">{p.description}</p>}
                  {(p.starts_on || p.ends_on) && (
                    <p className="promo-dates">
                      {[p.starts_on, p.ends_on].filter(Boolean)
                        .map((d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))
                        .join(' \u2013 ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
        <Section tone="white">
          <div className="prose-narrow">
            {v.editor_note && (
              <p className="prose-lead" style={{ fontStyle: 'italic',
                     borderLeft: '2px solid var(--gold)', paddingLeft: 20 }}>
                {v.editor_note}
              </p>
            )}
            <p className="prose-lead">
              {v.listing_description ?? v.venue_short_description}
            </p>
            {v.venue_full_description && <p>{v.venue_full_description}</p>}
            {v.introduction_text && <p>{v.introduction_text}</p>}
            {(v.property_type || v.architecture_style) && (
              <p className="muted-small">
                {[v.property_type, v.architecture_style].filter(Boolean).join(' · ')}
              </p>
            )}
            {!!(v.languages && v.languages.length) && (
              <p className="muted-small">
                Languages spoken: {Array.isArray(v.languages) ? v.languages.join(', ') : v.languages}
              </p>
            )}
          </div>
        </Section>

        <Section tone="cream" label="At a glance">
          <Glance stats={[
            ['Guests', v.max_guests],
            ['Bedrooms', v.total_bedrooms],
            ['Bathrooms', v.total_bathrooms],
            ['Spaces', v.spaces.length || null],
            ['Practices', v.categories.length || null],
            ['Established', v.established_year],
          ]} />
        </Section>

        {!!immediate.length && (
          <Section tone="white" label="The setting"
            title={v.setting_headline ?? 'Where it sits'}>
            <div className="prose-narrow" style={{ textAlign: 'center' }}>
              {v.setting_description && <p>{v.setting_description}</p>}
              <div className="amenity-pill-row" style={{ justifyContent: 'center' }}>
                {immediate.map((s: any) => (
                  <span key={s.setting_id} className="amenity-pill">{s.name}</span>
                ))}
              </div>
            </div>
          </Section>
        )}

        {!!v.categories.length && (
          <Section tone="cream" label="Ideal for"
            title="Retreats this venue is suited to">
            <div className="amenity-pill-row" style={{ justifyContent: 'center' }}>
              {v.categories.map((c: any) => (
                <span key={c.category_id} className="amenity-pill">{c.name}</span>
              ))}
            </div>
          </Section>
        )}

        <ExperienceBlock v={v} tone="white" />
        <HostBlock v={v} tone="cream" />
      </div>

      {/* ── spaces ─────────────────────────────────────────────────── */}
      {!!v.spaces.length && (
        <div id="panel-spaces" className="vpanel" hidden>
          <TabHero image={v.image_url} label="Retreat Spaces"
            title="Spaces That Hold Whatever You Bring"
            subtitle={`${v.spaces.length} distinct environments for practice, ceremony, and transformation`} />

          {/* Featured space — image beside the copy, the way the mockup opens */}
          {featured && (
            <Section tone="white">
              <div className="feature-block">
                <SpaceImage s={featured} />
                <div className="feature-content">
                  <p className="feature-label">Featured Space</p>
                  <h2 className="feature-title">{featured.name}</h2>
                  {featured.description && (
                    <p className="feature-text">{featured.description}</p>
                  )}
                  {!!spaceTags(featured).length && (
                    <div className="feature-tags">
                      {spaceTags(featured).map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Every other space — full image cards, alternating side to side */}
          {!!rest.length && (
            <Section tone="cream" label="All Practice Spaces">
              {rest.map((s: any, i: number) => {
                const reverse = i % 2 === 1;
                const copy = (
                  <div className="feature-content">
                    <h2 className="feature-title">{s.name}</h2>
                    {s.description && <p className="feature-text">{s.description}</p>}
                    {!!spaceTags(s).length && (
                      <div className="feature-tags">
                        {spaceTags(s).map((t) => <span key={t} className="tag">{t}</span>)}
                      </div>
                    )}
                  </div>
                );
                return (
                  <div key={s.id}
                    className={`feature-block${reverse ? ' feature-block--reverse' : ''}`}
                    style={i < rest.length - 1 ? { marginBottom: 60 } : undefined}>
                    {reverse
                      ? <>{copy}<SpaceImage s={s} /></>
                      : <><SpaceImage s={s} />{copy}</>}
                  </div>
                );
              })}
            </Section>
          )}

          {/* CTA — the charcoal band that closes the tab in the mockup */}
          <section className="section section--charcoal cta">
            <p className="cta-title">Questions About Our Spaces?</p>
            <p className="cta-text">
              We&rsquo;re happy to arrange a video tour or answer any questions
              about how our spaces might work for your retreat format.
            </p>
            <div className="cta-buttons">
              <a href="#enquire" className="btn btn--primary">Enquire About This Venue</a>
            </div>
          </section>
        </div>
      )}

      {/* ── accommodation ──────────────────────────────────────────── */}
      {!!v.rooms.length && (
        <div id="panel-stay" className="vpanel" hidden>
          <TabHero image={v.image_url} label="Accommodation"
            title="Where your group sleeps"
            subtitle={`${v.rooms.reduce((n: number, r: any) => n + (r.quantity ?? 1), 0)} rooms across ${v.rooms.length} types`} />

          {v.accommodation_description && (
            <Section tone="white" label="Stay with us">
              <div className="prose-narrow"><p>{v.accommodation_description}</p></div>
            </Section>
          )}

          <Section tone="cream" label="Room types" subtitle="Choose your sanctuary">
            <RoomGrid rooms={v.rooms} ratePlans={v.rate_plans} currency={v.price_currency} />
          </Section>

          <InEveryRoom rooms={v.rooms} tone="white" />
          {(v.check_in_time || v.check_out_time || !!v.minimum_stay_nights || v.minimum_child_age != null) && (
            <Section tone="cream" label="Stay details" title="Check-in and check-out">
              <div className="distance-list">
                {v.check_in_time && (
                  <div className="distance-row"><span className="distance-name">Check-in</span>
                    <span className="distance-time">{v.check_in_time}{v.early_checkin_available ? ' · Early check-in available' : ''}</span></div>
                )}
                {v.check_out_time && (
                  <div className="distance-row"><span className="distance-name">Check-out</span>
                    <span className="distance-time">{v.check_out_time}{v.late_checkout_available ? ' · Late check-out available' : ''}</span></div>
                )}
                {!!v.minimum_stay_nights && (
                  <div className="distance-row"><span className="distance-name">Minimum stay</span>
                    <span className="distance-time">{v.minimum_stay_nights} night{v.minimum_stay_nights === 1 ? '' : 's'}</span></div>
                )}
                {v.minimum_child_age != null && (
                  <div className="distance-row"><span className="distance-name">Minimum age</span>
                    <span className="distance-time">{v.minimum_child_age}+ years</span></div>
                )}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── amenities ──────────────────────────────────────────────── */}
      {(!!v.facilities.length || v.wifi_coverage || v.wifi_details || v.mobile_coverage || v.mobile_coverage_notes) && (
        <div id="panel-amenities" className="vpanel" hidden>
          {!!v.facilities.length && (
          <Section tone="white" label="Amenities"
            title="Everything your retreat needs">
            <div className="amenity-columns">
              {Object.entries(byCategory).map(([cat, items]) => (
                <div key={cat}>
                  <div className="amenity-cat">{cat}</div>
                  <div className="amenity-pill-row">
                    {(items as any[]).map((f) => (
                      <span key={f.facility_id} className="amenity-pill">
                        {f.name}{f.detail ? ` — ${f.detail}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          )}
          {(v.wifi_coverage || v.wifi_details || v.mobile_coverage || v.mobile_coverage_notes) && (
            <Section tone="cream" label="Connectivity" title="Staying connected">
              <div className="prose-narrow">
                {(v.wifi_coverage || v.wifi_details) && (
                  <p><strong>WiFi. </strong>{[v.wifi_coverage, v.wifi_details].filter(Boolean).join(' — ')}</p>
                )}
                {(v.mobile_coverage || v.mobile_coverage_notes) && (
                  <p><strong>Mobile. </strong>{[v.mobile_coverage, v.mobile_coverage_notes].filter(Boolean).join(' — ')}</p>
                )}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── experiences ────────────────────────────────────────────── */}
      {(!!v.services.length || !!v.excursions.length || !!v.extras?.length) && (
        <div id="panel-experiences" className="vpanel" hidden>
          <TabHero image={v.image_url} label="Experiences"
            title="Enhance your retreat"
            subtitle="Arranged by the venue, added to your booking" />

          {!!v.extras?.length && (
            <Section tone="cream" label="Extras" title="Add to your stay">
              <div className="item-grid">
                {v.extras.map((e: any) => (
                  <article key={e.id} className="item priced">
                    <div>
                      <h3>{e.name}</h3>
                      <div className="item-meta">{[e.extra_category, e.price_basis].filter(Boolean).join(' \u00b7 ')}</div>
                      {e.description && <p>{e.description}</p>}
                    </div>
                    <div className="priced-amount">{e.price != null ? money(e.price, e.currency) : 'On request'}</div>
                    <div className="item-action"><AddToCart kind="extra" id={e.id} max={e.maximum_quantity ?? 20} /></div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {!!v.services.length && (
            <Section tone="white">
              <div className="item-grid">
                {v.services.map((s: any) => (
                  <article key={s.id} className="item priced">
                    <div>
                      <h3>{s.name}</h3>
                      <div className="item-meta">
                        {[s.category, duration(s.duration_minutes)].filter(Boolean).join(' · ')}
                      </div>
                      {s.description && <p>{s.description}</p>}
                    </div>
                    <div className="priced-amount">
                      {s.price_is_from && <span className="from">from</span>}
                      {money(s.base_price, s.currency)}
                    </div>
                    <div className="item-action"><AddToCart kind="exp" id={s.id} /></div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {!!v.excursions.length && (
            <Section tone="cream" label="Beyond the venue" title="Local excursions">
              <div className="item-grid">
                {v.excursions.map((e: any) => (
                  <article key={e.id} className={e.price != null ? 'item priced' : 'item'}>
                    <div>
                      <h3>{e.name}</h3>
                      <div className="item-meta">
                        {[e.duration_label, e.difficulty].filter(Boolean).join(' · ')}
                      </div>
                      {e.description && <p>{e.description}</p>}
                    </div>
                    {e.price != null && (
                      <div className="priced-amount">{money(e.price, e.currency)}</div>
                    )}
                  </article>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── packages ───────────────────────────────────────────────── */}
      {!!v.packages.length && (
        <div id="panel-packages" className="vpanel" hidden>
          <PackagesPanel v={v} />
        </div>
      )}

      {/* ── location ───────────────────────────────────────────────── */}
      <div id="panel-location" className="vpanel" hidden>
        <TabHero image={v.image_url} label="Location"
          title={v.location_tagline ?? 'Where it is'} subtitle={place} />

        <Section tone="cream" label="Where it is" title="Address and map">
          <VenueMap v={v} />
        </Section>

        {v.location_intro && (
          <Section tone="white"><div className="prose-narrow"><p>{v.location_intro}</p></div></Section>
        )}

        <Section tone="white" label="The setting">
          {v.environment_notes && (
            <div className="prose-narrow" style={{ marginBottom: 20 }}><p>{v.environment_notes}</p></div>
          )}
          <div className="distance-list">
            {immediate.map((s: any) => (
              <div key={s.setting_id} className="distance-row">
                <span className="distance-name">{s.name}</span>
                <span className="distance-time">{s.detail ?? 'At the venue'}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Said separately. "Beachfront" and "twenty minutes from a
            beach" are different claims, and running them together is how
            a listing overstates itself. */}
        {/* Distances: the harvested travel times where present, otherwise
            the setting-based reachable list. */}
        {v.distances.length ? (
          <Section tone="cream" label="Getting there" title="Distances and travel times">
            <div className="distance-list">
              {v.distances.map((d: any) => (
                <div key={d.id} className="distance-row">
                  <span className="distance-name">{d.label}</span>
                  <span className="distance-time">
                    {d.travel_value != null
                      ? `${d.travel_value} ${d.travel_unit || 'min'}${d.travel_mode ? ` by ${d.travel_mode}` : ''}`
                      : 'Nearby'}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        ) : !!reachable.length && (
          <Section tone="cream" label="Getting there" title="Distances and travel times">
            <div className="distance-list">
              {reachable.map((s: any) => (
                <div key={s.setting_id} className="distance-row">
                  <span className="distance-name">{s.detail ?? s.name}</span>
                  <span className="distance-time">
                    {s.travel_minutes
                      ? `${s.travel_minutes} minutes${s.travel_mode ? ` by ${s.travel_mode.toLowerCase()}` : ''}`
                      : 'Nearby'}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {!!v.transfers.length && (
          <Section tone="white" label="Transfers" title="Getting to the door">
            <div className="item-grid">
              {v.transfers.map((t: any) => (
                <article key={t.id} className="item">
                  <h3>{t.title}</h3>
                  <div className="item-meta">
                    {[t.from_location && t.to_location ? `${t.from_location} to ${t.to_location}` : null,
                      t.duration_minutes ? `${t.duration_minutes} min` : null,
                      t.is_included ? 'Included' : (t.price != null ? money(t.price, t.price_currency) : null)]
                      .filter(Boolean).join(' · ')}
                  </div>
                  {t.description && <p>{t.description}</p>}
                </article>
              ))}
            </div>
          </Section>
        )}

        {(v.directions_note || v.parking_notes) && (
          <Section tone="white" label="Arrival" title="Directions and parking">
            <div className="prose-narrow">
              {v.directions_note && <p>{v.directions_note}</p>}
              {v.parking_notes && <p><strong>Parking. </strong>{v.parking_notes}</p>}
            </div>
          </Section>
        )}

        {/* Climate: the season table where present, otherwise the prose. */}
        {v.seasons.length ? (
          <Section tone="cream" label="Climate" title="When to visit">
            {v.climate_note && (
              <div className="prose-narrow" style={{ marginBottom: 20 }}><p>{v.climate_note}</p></div>
            )}
            <div className="distance-list">
              {v.seasons.map((s: any) => (
                <div key={s.id} className="distance-row">
                  <span className="distance-name">
                    {s.season_name}{s.months ? ` · ${s.months}` : ''}{s.is_peak ? ' · Peak' : ''}
                  </span>
                  <span className="distance-time">
                    {[s.temp_low != null && s.temp_high != null
                        ? `${s.temp_low}–${s.temp_high}°${s.temp_unit || 'C'}` : null,
                      s.best_for].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        ) : (v.climate_intro || v.best_months || v.climate_note) && (
          <Section tone="cream" label="Climate" title="What to expect">
            <div className="prose-narrow">
              {v.climate_intro && <p>{v.climate_intro}</p>}
              {v.climate_note && <p>{v.climate_note}</p>}
              {v.best_months && (
                <p className="muted-small">
                  Best months to visit: {Array.isArray(v.best_months)
                    ? v.best_months.join(', ') : v.best_months}
                </p>
              )}
            </div>
          </Section>
        )}

        <OpeningHours v={v} tone="white" />
        <Accessibility v={v} tone="cream" />
        <VenueLinks v={v} tone="white" />
      </div>

      {/* ── policies ───────────────────────────────────────────────── */}
      {(!!v.policies.length || !!v.faqs.length || v.cultural_protocol_details || hasBring) && (
        <div id="panel-policies" className="vpanel" hidden>
          {hasBring && (
            <Section tone="cream" label="What to bring" title="Coming prepared">
              <div className="prose-narrow">
                {v.please_bring?.length ? (
                  <>
                    <p><strong>Please bring</strong></p>
                    <div className="amenity-pill-row">
                      {v.please_bring.map((x: string, i: number) => <span key={i} className="amenity-pill">{x}</span>)}
                    </div>
                  </>
                ) : null}
                {v.optional_to_bring?.length ? (
                  <>
                    <p style={{ marginTop: 16 }}><strong>Optional</strong></p>
                    <div className="amenity-pill-row">
                      {v.optional_to_bring.map((x: string, i: number) => <span key={i} className="amenity-pill">{x}</span>)}
                    </div>
                  </>
                ) : null}
              </div>
            </Section>
          )}
          {v.cultural_protocol_details && (
            <Section tone="white" label="Please note" title="Cultural protocol">
              <div className="prose-narrow"><p>{v.cultural_protocol_details}</p></div>
            </Section>
          )}
          {!!v.policies.length && <PoliciesPanel v={v} />}
          {!!v.faqs.length && (
            <Section tone={v.policies.length ? 'cream' : 'white'}
              label="Common questions" title="Good to know">
              <div className="faq" style={{ maxWidth: 860, margin: '0 auto' }}>
                {v.faqs.map((f: any) => (
                  <details key={f.id} className="faq-item">
                    <summary className="faq-question">
                      <span>{f.question}</span>
                      <span className="faq-toggle" aria-hidden="true" />
                    </summary>
                    <div className="faq-answer"><p>{f.answer}</p></div>
                  </details>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── reviews ────────────────────────────────────────────────── */}
      {!!v.reviews.length && (
        <div id="panel-reviews" className="vpanel" hidden>
          <Section tone="white" label="Reviews"
            title={v.rating ? `${Number(v.rating).toFixed(1)} from ${v.review_count} stays` : 'Reviews'}
            subtitle="From hosts who ran a retreat here">
            <ReviewScores reviews={v.reviews} />
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              {v.reviews.map((r: any) => <Review key={r.id} r={r} venue={v.venue_name} />)}
            </div>
          </Section>
        </div>
      )}

      {/* ── enquire ────────────────────────────────────────────────── */}
      <div id="panel-enquire" className="vpanel" hidden>
        <Section tone="cream" label="Enquire" title="Or send an enquiry"
          subtitle="We answer within a day. Nothing is charged and nothing is committed.">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <VenueEnquiry venueId={v.id} venueName={v.venue_name} marketplace="Retreat" />
          </div>
        </Section>
      </div>

      {!!v.related.length && (
        <section className="section section--white">
          <div className="wrap">
            <div className="intro-eyebrow" style={{ textAlign: 'center' }}>Explore further</div>
            <h2 className="section-title" style={{ textAlign: 'center', marginBottom: 'var(--s5)' }}>
              You may also like
            </h2>
            <div className="related-grid">
              {v.related.map((c: any) => <VenueCard key={c.id} card={c} size={3} />)}
            </div>
          </div>
        </section>
      )}
    </BookingCart>
    </>
  );
}

export function ReviewScores({ reviews }: { reviews: any[] }) {
  const avg = (k: string) => {
    const nums = reviews.map((r) => r[k]).filter((n) => n != null);
    if (!nums.length) return null;
    return (nums.reduce((a, b) => a + Number(b), 0) / nums.length).toFixed(1);
  };
  const scores: [string, string | null][] = [
    ['Communication', avg('rating_communication')],
    ['Spaces', avg('rating_spaces')],
    ['Amenities', avg('rating_amenities')],
    ['Location', avg('rating_location')],
    ['Value', avg('rating_value')],
  ];
  const real = scores.filter(([, v]) => v);
  if (!real.length) return null;

  return (
    <div className="review-scores">
      {real.map(([label, value]) => (
        <div key={label} className="review-score">
          <div className="review-score-value">{value}</div>
          <div className="review-score-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function Review({ r, venue }: { r: any; venue: string }) {
  return (
    <article className="review">
      <div className="review-top">
        <div className="review-who">
          <strong>{r.reviewer_name}</strong>
          {r.reviewer_context && <span className="ctx"> · {r.reviewer_context}</span>}
        </div>
        <span className="review-stars">
          <span className="star">&#9733;</span> {Number(r.rating_overall).toFixed(1)}
        </span>
      </div>
      {r.title && <h3>{r.title}</h3>}
      <p>{r.body}</p>
      {r.is_verified && (
        <div className="review-verified">Verified — they booked through us</div>
      )}
      {r.response_body && (
        <div className="review-response">
          <div className="review-score-label" style={{ marginBottom: 8 }}>
            {venue} replied
          </div>
          <p>{r.response_body}</p>
        </div>
      )}
    </article>
  );
}
