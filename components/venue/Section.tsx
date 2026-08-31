import { duration, money } from '@/lib/venue';
import { OfferList } from '@/components/venue/OfferCard';
import { packageToOffer, excursionToOffer } from '@/lib/offers';
import { AddToCart } from './BookingCart';
import { RoomDetails } from './RoomDetails';
import { RoomGallery } from './RoomGallery';

export function Section({
  tone = 'white', label, title, subtitle, subtitleAs, children, id,
}: {
  tone?: 'white' | 'cream' | 'charcoal';
  label?: string; title?: string; subtitle?: string;
  /* 'address' sets the subtitle in serif at heading scale, for the location
     section where the address is the subheading rather than a caption. */
  subtitleAs?: 'address';
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className={`section section--${tone}`} id={id}
      style={id ? { scrollMarginTop: 90 } : undefined}>
      <div className="wrap">
        {(label || title || subtitle) && (
          <div className="section-header">
            {label && <div className="section-label">{label}</div>}
            {title && <h2 className="section-title">{title}</h2>}
            {subtitle && <p className={`section-subtitle${subtitleAs ? ` section-subtitle--${subtitleAs}` : ''}`}>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/* Each tab opens on its own image.
 *
 * From the template, and it does real work — it says which part of the
 * venue you are looking at before you read a word. */
export function TabHero({
  image, label, title, subtitle,
}: { image: string | null; label: string; title: string; subtitle?: string }) {
  if (!image) return null;
  return (
    <div className="tab-hero" style={{ backgroundImage: `url(${image})` }}>
      <div className="tab-hero-content">
        <div className="tab-hero-label">{label}</div>
        <h2 className="tab-hero-title">{title}</h2>
        {subtitle && <p className="tab-hero-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

/* At a glance.
 *
 * Only what is actually recorded. A stat block with an em dash in it is
 * worse than one with three entries — it advertises the gap. */
export function Glance({ stats }: { stats: [string, any][] }) {
  const real = stats.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!real.length) return null;
  return (
    <div className="stats-grid">
      {real.map(([label, value]) => (
        <div key={label} className="stat-item">
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* The experience write-up.
 *
 * Its own headline, subtitle and image, all from the record. Renders
 * nothing until there is something to say. */
export function ExperienceBlock({
  v, tone = 'cream',
}: { v: Record<string, any>; tone?: 'white' | 'cream' }) {
  if (!v.experience_description && !v.experience_title) return null;
  return (
    <Section tone={tone}
      title={v.experience_title ?? undefined}
      subtitle={v.experience_subtitle ?? undefined}>
      {v.experience_image_url ? (
        <div className="feature-split">
          <div><img src={v.experience_image_url} alt="" /></div>
          <div><p className="feature-body">{v.experience_description}</p></div>
        </div>
      ) : (
        v.experience_description && (
          <div className="prose-narrow"><p>{v.experience_description}</p></div>
        )
      )}
    </Section>
  );
}

/* Distances and travel times, as a stat grid.
 *
 * From tgs_retreat_venue_detail_v2: a big serif figure with a small unit
 * beside it, the place underneath. A list of rows answered the same question
 * but read as a timetable; the figures are what someone scans for when they
 * are working out whether a group can get there.
 *
 * Four across, because that is what the mockup sets and what a row of numbers
 * can hold before it stops being scannable. */
export function Distances({ v, tone = 'cream' }: { v: Record<string, any>; tone?: 'cream' | 'white' }) {
  // Travel times only. What's nearby is a separate section with a different
  // job, and mixing a shopping centre into a grid of airport transfers helps
  // nobody.
  const items = (v.distances ?? []).filter((d: any) => (d.listing_section ?? 'Travel') === 'Travel');
  if (!items.length) return null;
  return (
    <Section tone={tone} label="Distances & travel times">
      <div className="stat-grid stat-grid--4">
        {items.slice(0, 8).map((d: any) => (
          <div key={d.id} className="stat-item">
            <p className="stat-value">
              {d.travel_value != null ? (
                <>{d.travel_value}<span className="stat-unit">{d.travel_unit || 'min'}</span></>
              ) : d.distance_km != null ? (
                <>{d.distance_km}<span className="stat-unit">km</span></>
              ) : <span className="stat-unit stat-unit--alone">Nearby</span>}
            </p>
            <p className="stat-label">{d.label}</p>
            {/* Time and distance are different facts and a host wants both:
                the time tells them the day, the distance tells them whether a
                coach makes sense. */}
            {(d.distance_km != null || d.travel_mode) && (
              <p className="stat-note">
                {[d.travel_value != null && d.distance_km != null ? `${d.distance_km} km` : null,
                  d.travel_mode ? `by ${d.travel_mode}` : null].filter(Boolean).join(' \u00b7 ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* What is nearby, grouped.
 *
 * The travel grid answers whether a group can get here. This answers what is
 * around once they have, which is the question a host asks when working out
 * whether guests can walk to dinner or need a van.
 *
 * Grouped by category and ordered by distance within each, because the nearest
 * is almost always the relevant one. The category is free text so the groups
 * can grow without a migration.
 */
export function Nearby({ v, tone = 'white' }: { v: Record<string, any>; tone?: 'cream' | 'white' }) {
  const items = (v.distances ?? []).filter((d: any) => d.listing_section === 'Nearby');
  if (!items.length) return null;

  const groups = new Map<string, any[]>();
  for (const d of items) {
    const key = d.category || 'Nearby';
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => (a.distance_km ?? a.travel_value ?? 1e9) - (b.distance_km ?? b.travel_value ?? 1e9));
  }

  /* Distance then time, both where recorded. Under a kilometre reads better
     in metres. */
  const measure = (d: any) => {
    const parts: string[] = [];
    if (d.distance_km != null) {
      const km = Number(d.distance_km);
      parts.push(km < 1 ? `${Math.round(km * 1000)} m` : `${km % 1 === 0 ? km : km.toFixed(1)} km`);
    }
    if (d.travel_value != null) parts.push(`${d.travel_value} ${d.travel_unit || 'min'}`);
    return parts.join(' \u00b7 ');
  };

  return (
    <Section tone={tone} label="What's nearby">
      <div className="nearby-grid">
        {[...groups.entries()].map(([name, list]) => (
          <div key={name} className="nearby-group">
            <h4 className="nearby-heading">{name}</h4>
            <ul className="nearby-list">
              {list.map((d: any) => (
                <li key={d.id}>
                  <span className="nearby-place">{d.label}</span>
                  <span className="nearby-dist">{measure(d)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* Climate and best time to visit, as season cards.
 *
 * Season, months, the temperature range large, then what the season is like.
 * The range is the number people compare, so it carries the weight. */
export function Climate({ v, tone = 'white' }: { v: Record<string, any>; tone?: 'cream' | 'white' }) {
  const seasons = v.seasons ?? [];
  if (!seasons.length && !v.climate_note && !v.climate_intro) return null;
  return (
    <Section tone={tone} label="Climate & best time to visit">
      {(v.climate_intro || v.climate_note) && (
        <div className="prose-narrow" style={{ marginBottom: 32 }}>
          <p>{v.climate_intro || v.climate_note}</p>
        </div>
      )}
      {seasons.length > 0 && (
        <div className={`season-grid season-grid--${Math.min(seasons.length, 4)}`}>
          {seasons.map((s: any) => (
            <div key={s.id} className={`season-card${s.is_peak ? ' season-card--peak' : ''}`}>
              {s.is_peak && <span className="season-peak">Peak</span>}
              <p className="season-name">{s.season_name}</p>
              {s.months && <p className="season-months">{s.months}</p>}
              {s.temp_low != null && s.temp_high != null && (
                <p className="season-temp">{s.temp_low}–{s.temp_high}°{s.temp_unit || 'C'}</p>
              )}
              {(s.description || s.best_for) && (
                <p className="season-desc">{s.description || s.best_for}</p>
              )}
              {s.rainfall_note && <p className="season-rain">{s.rainfall_note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* What to bring and what to know. Sits with climate because that is
          what governs it: a Blue Mountains winter and a Byron summer ask for
          different bags. */}
      {(v.packing_note || v.travel_advice) && (
        <div className="local-notes">
          {v.packing_note && (
            <div className="local-note">
              <h4>What to bring</h4>
              <p>{v.packing_note}</p>
            </div>
          )}
          {v.travel_advice && (
            <div className="local-note">
              <h4>Worth knowing</h4>
              <p>{v.travel_advice}</p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

/* Accessibility.
 *
 * The step-free facts as pills, then the path notes and any access
 * policy in words. Only the affordances that are true are shown — a
 * crossed-out list reads as an apology. */
export function Accessibility({
  v, tone = 'white',
}: { v: Record<string, any>; tone?: 'white' | 'cream' }) {
  const flags = ([
    [v.step_free_entrance, 'Step-free entrance'],
    [v.step_free_to_dining, 'Step-free to dining'],
    [v.step_free_to_practice_space, 'Step-free to practice space'],
    [v.accessible_parking, 'Accessible parking'],
  ] as [any, string][]).filter(([on]) => on).map(([, label]) => label);

  const hasPolicy = v.access_policy_type || v.access_policy_details;
  if (!flags.length && !v.access_path_notes && !hasPolicy
      && !v.accessibility_summary && !v.accessibility_notes) return null;

  return (
    <Section tone={tone} title="Accessibility">
      {!!flags.length && (
        <div className="amenity-pill-row" style={{ justifyContent: 'center' }}>
          {flags.map((f) => <span key={f} className="amenity-pill">{f}</span>)}
        </div>
      )}
      {(v.access_path_notes || hasPolicy || v.accessibility_summary || v.accessibility_notes) && (
        <div className="prose-narrow"
          style={{ marginTop: flags.length ? 24 : 0, textAlign: 'center' }}>
          {v.accessibility_summary && <p>{v.accessibility_summary}</p>}
          {v.access_path_notes && <p>{v.access_path_notes}</p>}
          {v.accessibility_notes && <p>{v.accessibility_notes}</p>}
          {hasPolicy && (
            <p>
              {v.access_policy_type && <strong>{v.access_policy_type}. </strong>}
              {v.access_policy_details}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

/* Where to find the venue elsewhere — the site and the socials, when the
 * record carries them. */
export function VenueLinks({
  v, tone = 'cream',
}: { v: Record<string, any>; tone?: 'white' | 'cream' }) {
  const links = ([
    [v.website_url, 'Visit website'],
    [v.instagram_url, 'Instagram'],
    [v.facebook_url, 'Facebook'],
  ] as [any, string][]).filter(([url]) => url);
  if (!links.length) return null;

  return (
    <Section tone={tone} title="Find them online">
      <div className="amenity-pill-row" style={{ justifyContent: 'center' }}>
        {links.map(([url, label]) => (
          <a key={url} className="amenity-pill" href={url}
             target="_blank" rel="noopener">{label}</a>
        ))}
      </div>
    </Section>
  );
}

/* The hosts.
 *
 * Only shown when the venue chose to — the profile view returns null for
 * every host field otherwise, so this renders nothing rather than a
 * half-empty block. */
export function HostBlock({
  v, tone = 'cream',
}: { v: Record<string, any>; tone?: 'white' | 'cream' }) {
  if (!v.host_display_names && !v.host_bio && !v.host_quote) return null;

  const stats = [
    v.years_hosting ? `${v.years_hosting} years hosting` : null,
    v.retreats_per_year ? `${v.retreats_per_year} retreats a year` : null,
    v.total_retreats_hosted ? `${v.total_retreats_hosted} retreats hosted` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Section tone={tone} label="Your hosts" title={v.host_display_names ?? undefined}>
      {v.host_quote && (
        <div className="prose-narrow">
          <p className="prose-lead" style={{ fontStyle: 'italic' }}>{v.host_quote}</p>
        </div>
      )}
      {v.host_image_url ? (
        <div className="feature-split">
          <div><img src={v.host_image_url} alt={v.host_display_names ?? ''} /></div>
          <div>
            {v.host_bio && <p className="feature-body">{v.host_bio}</p>}
            {stats && <div className="feature-meta">{stats}</div>}
          </div>
        </div>
      ) : (
        <div className="prose-narrow">
          {v.host_bio && <p>{v.host_bio}</p>}
          {stats && <p className="muted-small">{stats}</p>}
        </div>
      )}
    </Section>
  );
}

/* Packages — set programmes, priced. Its items come through as a JSON
 * array on the view, aggregated so the whole package is one row. */
export function PackagesPanel({ v }: { v: Record<string, any> }) {
  /* Packages carry more written detail than anything else on the platform:
     every row has a tagline, description, duration and price basis. They were
     rendering in the same compact tile as everything else, which threw most of
     it away. Same card as treatments and excursions now, so a package reads as
     the larger thing it is. */
  const offers = v.packages.map((p: any) => {
    const fromItems = (p.items ?? []).map((i: any) => i.label).filter(Boolean);
    return packageToOffer(
      { ...p, inclusions: [...(Array.isArray(p.inclusions) ? p.inclusions : []), ...fromItems] },
      v.offer_media ?? [], v.package_focus ?? [],
    );
  });

  return (
    <>
      <TabHero image={v.image_url} label="Packages" title="Curated packages"
        subtitle="Set programmes, priced and ready to enquire on" />
      <Section tone="white">
        <OfferList offers={offers} />
      </Section>
    </>
  );
}

/* Excursions: bookable things nearby, run by the venue or by a local operator.
   The same card again; a guided walk and a massage are the same object to
   somebody deciding whether to add one. */
export function ExcursionsPanel({ v }: { v: Record<string, any> }) {
  if (!v.excursions?.length) return null;
  return (
    <Section tone="cream" label="Nearby" title="Out from the venue">
      <OfferList offers={v.excursions.map((e: any) => excursionToOffer(e))} />
    </Section>
  );
}

/* Practitioners. */
export function PractitionersPanel({ v }: { v: Record<string, any> }) {
  return (
    <>
      <TabHero image={v.image_url} label="Practitioners" title="Who you will meet"
        subtitle="The people who hold the work here" />
      <Section tone="white">
        <div className="item-grid">
          {v.practitioners.map((pr: any) => (
            <article key={pr.id} className="item">
              <h3>{pr.full_name}</h3>
              <div className="item-meta">
                {[pr.title, pr.credentials].filter(Boolean).join(' · ')}
              </div>
              {pr.bio && <p>{pr.bio}</p>}
              {!!pr.specialties?.length && (
                <div className="item-note">{pr.specialties.join(' · ')}</div>
              )}
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}

/* The venue's own documents, linked rather than reproduced.
 *
 * The stay is a contract with the venue, so a guest should be able to read the
 * venue's terms before they book, not only at checkout. Rendered from the venue
 * register, so nothing appears until a document is published. */
export function VenueDocuments({ v }: { v: Record<string, any> }) {
  const docs = (v.legal_documents ?? []).filter((d: any) => d.show_in_good_to_know);
  if (!docs.length) return null;
  return (
    <div className="venue-docs">
      <h3>Documents for this venue</h3>
      <p className="venue-docs-note">
        These are the venue&rsquo;s own terms. They govern your stay, and you&rsquo;ll
        be asked to accept them when you book.
      </p>
      <ul className="venue-docs-list">
        {docs.map((d: any) => (
          <li key={d.document_id ?? d.slug}>
            <a href={`/legal/venue/${v.id}/${d.slug}`}>{d.name}</a>
            {d.version_label && <span className="venue-docs-v">{d.version_label}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Policies — arrival, etiquette, health and safety, payment. Prose
 * blocks, each in the venue's own words. */
export function PoliciesPanel({ v }: { v: Record<string, any> }) {
  return (
    <Section tone="white" label="Policies" title="Good to know">
      <div className="prose-narrow">
        {v.policies.map((po: any) => (
          <div key={po.id} style={{ marginBottom: 'var(--s6)' }}>
            <h3>{po.title || po.policy_type}</h3>
            <p>{po.body}</p>
          </div>
        ))}
        <VenueDocuments v={v} />
      </div>
    </Section>
  );
}

/* Opening hours. day_of_week is 0 (Sunday) to 6 (Saturday); times arrive
 * as HH:MM:SS and are shown to the minute. */
export function OpeningHours({
  v, tone = 'white',
}: { v: Record<string, any>; tone?: 'white' | 'cream' }) {
  if (!v.opening_hours?.length) return null;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fmt = (t: string | null) => (t ? t.slice(0, 5) : null);
  return (
    <Section tone={tone} label="Hours" title="Opening hours">
      <div className="distance-list">
        {v.opening_hours.map((h: any) => (
          <div key={h.id} className="distance-row">
            <span className="distance-name">{DAYS[h.day_of_week] ?? '—'}</span>
            <span className="distance-time">
              {h.is_closed
                ? 'Closed'
                : (h.opens_at && h.closes_at)
                  ? `${fmt(h.opens_at)} – ${fmt(h.closes_at)}`
                  : (h.notes ?? '—')}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* Room cards. Image, then the room in words — the mockup's card grid
 * rather than the plain rows the tab used to render. */
export function RoomGrid({ rooms, ratePlans = [], currency = 'AUD' }: { rooms: any[]; ratePlans?: any[]; currency?: string | null }) {
  const planFor = (id: number) =>
    ratePlans.find((rp) => (rp.applies_to === 'Room Type' || rp.applies_to === 'Room') && rp.target_id === id);
  const basisLabel = (b: string | null) => {
    switch (b) {
      case 'Per Night': case 'Per Day': return 'per night';
      case 'Per Person Per Night': return 'per person / night';
      case 'Per Group Per Night': return 'per night';
      case 'Per Person': return 'per person';
      default: return '';
    }
  };
  return (
    <div className="room-grid">
      {rooms.map((r) => (
        <article key={r.id} className="room-card">
          <RoomGallery images={r.gallery_images ?? []} name={r.name ?? 'Room'} />
          <div className="room-card-body">
            <h3 className="room-card-name">{r.name}</h3>
            <div className="room-card-meta">
              {[r.quantity ? `${r.quantity} available` : null,
                r.sleeps ? `Sleeps ${r.sleeps}` : null,
                r.bed_configuration, r.bathroom_type,
                r.room_size ? `${r.room_size} ${r.room_size_unit ?? 'sqm'}` : null,
                r.is_accessible ? 'Accessible' : null,
              ].filter(Boolean).join(' · ')}
            </div>
            {r.description && <p className="room-card-desc">{r.description}</p>}
            <div className="room-card-links">
              <RoomDetails room={r} />
            </div>
            <div className="room-card-action">
              {(() => { const rp = planFor(r.id); return rp && rp.base_price != null
                ? <div className="room-card-price">From {money(rp.base_price, rp.currency ?? currency)} <span>{basisLabel(rp.pricing_basis)}</span></div>
                : null; })()}
              <AddToCart kind="room" id={r.id} max={r.quantity ?? 9} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/* What every room carries — computed as the amenities common to all
 * rooms, so it is true rather than asserted. Nothing shows unless there
 * is a genuine shared set. */
export function InEveryRoom({
  rooms, tone = 'white',
}: { rooms: any[]; tone?: 'white' | 'cream' }) {
  const lists = rooms
    .map((r): string[] => (Array.isArray(r.room_amenities) ? r.room_amenities : []))
    .filter((l) => l.length);
  if (lists.length < 2) return null;
  const shared = lists.reduce((a: string[], b: string[]) => a.filter((x) => b.includes(x)));
  if (!shared.length) return null;
  return (
    <Section tone={tone} label="In every room" title="Standard across all rooms">
      <div className="amenity-pill-row" style={{ justifyContent: 'center' }}>
        {shared.map((a) => <span key={a} className="amenity-pill">{a}</span>)}
      </div>
    </Section>
  );
}
