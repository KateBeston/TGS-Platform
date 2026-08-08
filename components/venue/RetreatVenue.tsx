import Link from 'next/link';
import VenueTabs from '@/components/VenueTabs';
import VenueEnquiry from '@/components/VenueEnquiry';
import {
  Accessibility, ExperienceBlock, Glance, HostBlock, OpeningHours,
  PackagesPanel, PoliciesPanel, PractitionersPanel, Section, TabHero, VenueLinks,
} from './Section';
import { duration, money } from '@/lib/venue';

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

  const tabs = [
    { id: 'overview', label: 'Overview' },
    v.spaces.length && { id: 'spaces', label: 'Spaces' },
    v.rooms.length && { id: 'stay', label: 'Accommodation' },
    v.facilities.length && { id: 'amenities', label: 'Amenities' },
    v.services.length && { id: 'experiences', label: 'Experiences' },
    v.packages.length && { id: 'packages', label: 'Packages' },
    v.practitioners.length && { id: 'practitioners', label: 'Practitioners' },
    { id: 'location', label: 'Location' },
    v.policies.length && { id: 'policies', label: 'Policies' },
    v.reviews.length && { id: 'reviews', label: 'Reviews' },
    { id: 'enquire', label: 'Enquire' },
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <>
      <div className="hero-gallery">
        {v.image_url && <img className="hero-main-img" src={v.image_url} alt={v.venue_name} />}
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">{v.venue_type}</div>
          <h1 className="hero-venue-name">{v.headline ?? v.venue_name}</h1>
          <div className="hero-location">{place}</div>
        </div>
      </div>

      <VenueTabs tabs={tabs} venueName={v.venue_name} location={v.city ?? v.country ?? ''} />

      {/* ── overview ───────────────────────────────────────────────── */}
      <div id="panel-overview" className="vpanel">
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
          <TabHero image={v.image_url} label="The spaces"
            title="Spaces that hold whatever you bring"
            subtitle={`${v.spaces.length} across the property`} />

          {featured && (
            <Section tone="white">
              <div className="feature-split">
                <div>
                  {v.image_url && <img src={v.image_url} alt="" />}
                </div>
                <div>
                  <div className="feature-eyebrow">Featured space</div>
                  <h3 className="feature-title">{featured.name}</h3>
                  <div className="feature-meta">
                    {[featured.space_type,
                      featured.capacity ? `Holds ${featured.capacity}` : null,
                      featured.area ? `${featured.area} ${featured.area_unit ?? 'sqm'}` : null,
                      featured.flooring,
                      featured.step_free_access ? 'Step-free' : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  <p className="feature-body">{featured.description}</p>
                  {!!featured.equipment_provided?.length && (
                    <div className="amenity-pill-row" style={{ marginTop: 22 }}>
                      {featured.equipment_provided.map((e: string) => (
                        <span key={e} className="amenity-pill">{e}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {!!rest.length && (
            <Section tone="cream" label="And also">
              <div className="item-grid">
                {rest.map((s: any) => (
                  <article key={s.id} className="item">
                    <h3>{s.name}</h3>
                    <div className="item-meta">
                      {[s.space_type,
                        s.capacity ? `Holds ${s.capacity}` : null,
                        s.area ? `${s.area} ${s.area_unit ?? 'sqm'}` : null,
                        s.is_outdoor ? 'Outdoor' : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                    {s.description && <p>{s.description}</p>}
                    {!!s.equipment_provided?.length && (
                      <div className="item-note">{s.equipment_provided.join(' · ')}</div>
                    )}
                  </article>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── accommodation ──────────────────────────────────────────── */}
      {!!v.rooms.length && (
        <div id="panel-stay" className="vpanel" hidden>
          <TabHero image={v.image_url} label="Accommodation"
            title="Where your group sleeps"
            subtitle={`${v.rooms.reduce((n: number, r: any) => n + (r.quantity ?? 1), 0)} rooms across ${v.rooms.length} types`} />

          <Section tone="white">
            {v.accommodation_description && (
              <div className="prose-narrow" style={{ marginBottom: 40 }}>
                <p>{v.accommodation_description}</p>
              </div>
            )}
            <div className="item-grid">
              {v.rooms.map((r: any) => (
                <article key={r.id} className="item">
                  <h3>{r.name}</h3>
                  <div className="item-meta">
                    {[r.quantity ? `${r.quantity} available` : null,
                      r.sleeps ? `Sleeps ${r.sleeps}` : null,
                      r.bed_configuration, r.bathroom_type,
                      r.room_size ? `${r.room_size} ${r.room_size_unit ?? 'sqm'}` : null,
                      r.is_accessible ? 'Accessible' : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {r.description && <p>{r.description}</p>}
                  {!!r.room_amenities?.length && (
                    <div className="item-note">{r.room_amenities.join(' · ')}</div>
                  )}
                </article>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── amenities ──────────────────────────────────────────────── */}
      {!!v.facilities.length && (
        <div id="panel-amenities" className="vpanel" hidden>
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
        </div>
      )}

      {/* ── experiences ────────────────────────────────────────────── */}
      {!!v.services.length && (
        <div id="panel-experiences" className="vpanel" hidden>
          <TabHero image={v.image_url} label="Experiences"
            title="Enhance your retreat"
            subtitle="Arranged by the venue, added to your booking" />

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
                </article>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── packages ───────────────────────────────────────────────── */}
      {!!v.packages.length && (
        <div id="panel-packages" className="vpanel" hidden>
          <PackagesPanel v={v} />
        </div>
      )}

      {/* ── practitioners ──────────────────────────────────────────── */}
      {!!v.practitioners.length && (
        <div id="panel-practitioners" className="vpanel" hidden>
          <PractitionersPanel v={v} />
        </div>
      )}

      {/* ── location ───────────────────────────────────────────────── */}
      <div id="panel-location" className="vpanel" hidden>
        <TabHero image={v.image_url} label="Location"
          title={v.location_tagline ?? 'Where it is'} subtitle={place} />

        <Section tone="white" label="The setting">
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
        {!!reachable.length && (
          <Section tone="cream" label="Getting there"
            title="Distances and travel times">
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

        {(v.climate_intro || v.best_months) && (
          <Section tone="white" label="Climate" title="What to expect">
            <div className="prose-narrow">
              {v.climate_intro && <p>{v.climate_intro}</p>}
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
      {!!v.policies.length && (
        <div id="panel-policies" className="vpanel" hidden>
          <PoliciesPanel v={v} />
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
        <Section tone="cream" label="Enquire" title="Plan your retreat"
          subtitle="We answer within a day. Nothing is charged and nothing is committed.">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <VenueEnquiry venueId={v.id} venueName={v.venue_name} marketplace="Retreat" />
          </div>
        </Section>
      </div>
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
