import VenueTabs from '@/components/VenueTabs';
import VenueMap from './VenueMap';
import { BookingCart, AddToCart } from './BookingCart';
import { FavouriteButton } from '@/components/SavedVenues';
import { ImageCarousel } from './ImageCarousel';
import VenueEnquiry from '@/components/VenueEnquiry';
import VenueCard from '@/components/VenueCard';
import { Review, ReviewScores } from './RetreatVenue';
import {
  Accessibility, ExperienceBlock, Glance, HostBlock, InEveryRoom, OpeningHours,
  PackagesPanel, PoliciesPanel, PractitionersPanel, RoomGrid, Section, TabHero, VenueLinks,
} from './Section';
import { duration, money } from '@/lib/venue';

/* The wellness venue template.
 *
 * A wellness guest is deciding what to book and for when. So the menu
 * comes first — before the building, before the setting — because that
 * is the question. A retreat host wants the shala; a guest wants to know
 * what ninety minutes costs and whether they can have it in their room.
 *
 * Deliberately not the retreat template. Same data underneath, different
 * order, different emphasis, and different words. */

export default function WellnessVenue({ v }: { v: Record<string, any> }) {
  const immediate = v.settings.filter((s: any) => s.relation === 'Immediate');
  const reachable = v.settings.filter((s: any) => s.relation === 'Reachable');

  const place = [v.what_they_call_it ?? v.locality, v.city, v.country]
    .filter(Boolean).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i)
    .join(', ');

  // Grouped by what it is, so somebody after a massage is not reading
  // past the thermal circuit to find it.
  const byCategory = v.services.reduce((acc: Record<string, any[]>, s: any) => {
    const k = s.category ?? 'Other';
    (acc[k] ??= []).push(s);
    return acc;
  }, {});

  const facilitiesByCategory = v.facilities.reduce(
    (acc: Record<string, any[]>, f: any) => {
      const k = f.category ?? 'Other';
      (acc[k] ??= []).push(f);
      return acc;
    }, {});

  const cheapest = v.services
    .map((s: any) => s.base_price).filter((p: any) => p != null && p > 0)
    .sort((a: number, b: number) => a - b)[0];

  const hasBring = !!(v.please_bring?.length || v.optional_to_bring?.length);
  const tabs = [
    { id: 'overview', label: 'Overview' },
    (v.services.length || v.extras?.length) && { id: 'services', label: 'Services' },
    v.packages.length && { id: 'packages', label: 'Packages' },
    v.practitioners.length && { id: 'practitioners', label: 'Practitioners' },
    v.spaces.length && { id: 'space', label: 'The space' },
    v.rooms.length && { id: 'stay', label: 'Stay' },
    (v.facilities.length || v.wifi_coverage || v.wifi_details || v.mobile_coverage || v.mobile_coverage_notes) && { id: 'facilities', label: 'Facilities' },
    { id: 'visiting', label: 'Visiting' },
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
            ['Services', v.services.length || null],
            ['From', cheapest ? money(cheapest, v.services[0]?.currency) : null],
            ['Capacity', v.max_guests],
            ['Rooms', v.rooms.length ? v.rooms.reduce(
              (n: number, r: any) => n + (r.quantity ?? 1), 0) : null],
            ['Bathrooms', v.total_bathrooms],
            ['Established', v.established_year],
          ]} />
        </Section>

        {!!v.categories.length && (
          <Section tone="white" label="What is offered here"
            title="Modalities and traditions">
            <div className="amenity-pill-row" style={{ justifyContent: 'center' }}>
              {v.categories.map((c: any) => (
                <span key={c.category_id} className="amenity-pill">{c.name}</span>
              ))}
            </div>
          </Section>
        )}

        <ExperienceBlock v={v} tone="cream" />
        <HostBlock v={v} tone="white" />
      </div>

      {/* Services first, because that is the question a guest is here to
          answer. Grouped, so somebody after a massage is not reading past
          the thermal circuit to find it. */}
      {(!!v.services.length || !!v.extras?.length) && (
        <div id="panel-services" className="vpanel" hidden>
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
          <TabHero image={v.image_url} label="The menu" title="What is offered"
            subtitle={cheapest
              ? `From ${money(cheapest, v.services[0]?.currency)}`
              : undefined} />

          {Object.entries(byCategory).map(([cat, items], i) => (
            <Section key={cat} tone={i % 2 ? 'cream' : 'white'} label={cat}>
              <div className="item-grid">
                {(items as any[]).map((s) => (
                  <article key={s.id} className="item priced">
                    <div>
                      <h3>{s.name}</h3>
                      <div className="item-meta">
                        {[duration(s.duration_minutes),
                          s.couples_available ? 'For two' : null,
                          s.available_in_room ? 'In your room' : null,
                        ].filter(Boolean).join(' · ')}
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
          ))}
        </div>
      )}

      {!!v.packages.length && (
        <div id="panel-packages" className="vpanel" hidden>
          <PackagesPanel v={v} />
        </div>
      )}

      {!!v.practitioners.length && (
        <div id="panel-practitioners" className="vpanel" hidden>
          <PractitionersPanel v={v} />
        </div>
      )}

      {!!v.spaces.length && (
        <div id="panel-space" className="vpanel" hidden>
          <TabHero image={v.image_url} label="The space"
            title={v.setting_headline ?? 'Inside'} />
          {v.setting_description && (
            <Section tone="white"><div className="prose-narrow"><p>{v.setting_description}</p></div></Section>
          )}
          <Section tone="white">
            <div className="item-grid">
              {v.spaces.map((s: any) => (
                <article key={s.id} className="item">
                  <h3>{s.name}</h3>
                  <div className="item-meta">
                    {[s.space_type,
                      s.capacity ? `Holds ${s.capacity}` : null,
                      s.is_outdoor ? 'Outdoor' : null,
                      s.step_free_access ? 'Step-free' : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {s.description && <p>{s.description}</p>}
                </article>
              ))}
            </div>
          </Section>
        </div>
      )}

      {!!v.rooms.length && (
        <div id="panel-stay" className="vpanel" hidden>
          <Section tone="white" label="Stay" title="If you are staying">
            {v.accommodation_description && (
              <div className="prose-narrow" style={{ marginBottom: 40 }}>
                <p>{v.accommodation_description}</p>
              </div>
            )}
            <RoomGrid rooms={v.rooms} ratePlans={v.rate_plans} currency={v.price_currency} />
          </Section>
          <InEveryRoom rooms={v.rooms} tone="cream" />
          {(v.check_in_time || v.check_out_time || !!v.minimum_stay_nights || v.minimum_child_age != null) && (
            <Section tone="white" label="Stay details" title="Check-in and check-out">
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

      {(!!v.facilities.length || v.wifi_coverage || v.wifi_details || v.mobile_coverage || v.mobile_coverage_notes) && (
        <div id="panel-facilities" className="vpanel" hidden>
          {!!v.facilities.length && (
          <Section tone="white" label="Facilities" title="What is here">
            <div className="amenity-columns">
              {Object.entries(facilitiesByCategory).map(([cat, items]) => (
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

      <div id="panel-visiting" className="vpanel" hidden>
        <TabHero image={v.image_url} label="Visiting"
          title={v.location_tagline ?? 'Finding us'} subtitle={place} />

        <Section tone="cream" label="Where it is" title="Address and map">
          <VenueMap v={v} />
        </Section>

        {v.location_intro && (
          <Section tone="white"><div className="prose-narrow"><p>{v.location_intro}</p></div></Section>
        )}

        {(!!immediate.length || v.environment_notes) && (
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
        )}

        {v.distances.length ? (
          <Section tone="cream" label="Getting here" title="Distances and travel times">
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
          <Section tone="cream" label="Nearby">
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

        {!!v.excursions.length && (
          <Section tone="cream" label="Around here" title="Things to do nearby">
            <div className="item-grid">
              {v.excursions.map((e: any) => (
                <article key={e.id} className={e.price != null ? 'item priced' : 'item'}>
                  <div>
                    <h3>{e.name}</h3>
                    <div className="item-meta">{[e.duration_label, e.difficulty].filter(Boolean).join(' · ')}</div>
                    {e.description && <p>{e.description}</p>}
                  </div>
                  {e.price != null && <div className="priced-amount">{money(e.price, e.currency)}</div>}
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

        {(!!v.seasons.length || v.climate_intro || v.climate_note) && (
          <Section tone="white" label="Climate" title="When to visit">
            {(v.climate_intro || v.climate_note) && (
              <div className="prose-narrow" style={{ marginBottom: 20 }}>
                {v.climate_intro && <p>{v.climate_intro}</p>}
                {v.climate_note && <p>{v.climate_note}</p>}
              </div>
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
        )}

        <OpeningHours v={v} tone="white" />
        <Accessibility v={v} tone="cream" />
        <VenueLinks v={v} tone="white" />
      </div>

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

      {!!v.reviews.length && (
        <div id="panel-reviews" className="vpanel" hidden>
          <Section tone="white" label="Reviews"
            title={v.rating ? `${Number(v.rating).toFixed(1)} from ${v.review_count} visits` : 'Reviews'}
            subtitle="From guests who booked through us">
            <ReviewScores reviews={v.reviews} />
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              {v.reviews.map((r: any) => <Review key={r.id} r={r} venue={v.venue_name} />)}
            </div>
          </Section>
        </div>
      )}

      <div id="panel-enquire" className="vpanel" hidden>
        <Section tone="cream" label="Enquire" title="Or send an enquiry"
          subtitle="We answer within a day. Nothing is charged and nothing is committed.">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <VenueEnquiry venueId={v.id} venueName={v.venue_name} marketplace="Wellness" />
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
