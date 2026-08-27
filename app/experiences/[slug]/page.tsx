/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExperience, experienceImage, experiencePlace } from '@/lib/bookingExperiences';
import ExperienceBooking from '@/components/venue/ExperienceBooking';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

function money(v: number | null, ccy: string | null, from: boolean | null) {
  if (v == null) return null;
  const s = new Intl.NumberFormat('en-AU', { style: 'currency', currency: ccy || 'AUD', maximumFractionDigits: 0 }).format(v);
  return from ? `from ${s}` : s;
}
function duration(mins: number | null) {
  if (!mins) return null;
  if (mins < 60) return `${mins} minutes`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const e = await getExperience(slug);
  if (!e) return { title: 'Experience — The Global Sanctum' };
  return {
    title: `${e.name} — ${e.venue_name} — The Global Sanctum`,
    description: e.description?.slice(0, 155) ?? undefined,
  };
}

export default async function ExperienceDetail({ params }: Params) {
  const { slug } = await params;
  const e = await getExperience(slug);
  if (!e) notFound();

  const img = experienceImage(e);
  const place = experiencePlace(e);
  const price = money(e.base_price, e.currency, e.price_is_from);
  const dur = duration(e.duration_minutes);
  const venueHref = e.marketplace && e.listing_slug ? `/${e.marketplace}/${e.listing_slug}` : null;

  const facts: { label: string; value: string }[] = [];
  if (dur) facts.push({ label: 'Duration', value: dur });
  if (e.category) facts.push({ label: 'Category', value: e.category });
  if (e.practice) facts.push({ label: 'Practice', value: e.practice });
  if (e.couples_available) facts.push({ label: 'Couples', value: 'Available for two' });
  if (e.available_in_room) facts.push({ label: 'In-room', value: 'Available in your room' });
  if (e.max_participants) facts.push({ label: 'Group size', value: `Up to ${e.max_participants}` });

  return (
    <div className="xd-page">
      <div className="xd-crumbs">
        <Link href="/experiences">Wellness Experiences</Link>
        <span aria-hidden="true">/</span>
        <span>{e.name}</span>
      </div>

      <div className="xd-hero">
        {img ? <img src={img} alt={e.name} className="xd-hero-img" /> : <div className="xd-hero-noimg" />}
        <div className="xd-hero-info">
          {e.category && <div className="xd-eyebrow">{e.category}</div>}
          <h1 className="xd-title">{e.name}</h1>
          <div className="xd-venue">
            {venueHref ? <Link href={venueHref}>{e.venue_name}</Link> : e.venue_name}
            {place && <span className="xd-place"> · {place}</span>}
          </div>
        </div>
      </div>

      <div className="xd-body">
        <div className="xd-main">
          {e.description && (
            <section className="xd-sect">
              <h2>About this experience</h2>
              <p className="xd-prose">{e.description}</p>
            </section>
          )}

          {e.price_includes && (
            <section className="xd-sect">
              <h2>What&rsquo;s included</h2>
              <p className="xd-prose">{e.price_includes}</p>
            </section>
          )}

          {e.expected_outcomes && e.expected_outcomes.length > 0 && (
            <section className="xd-sect">
              <h2>How you&rsquo;ll feel</h2>
              <ul className="xd-list">
                {e.expected_outcomes.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </section>
          )}

          {e.what_to_bring && (
            <section className="xd-sect">
              <h2>What to bring</h2>
              <p className="xd-prose">{e.what_to_bring}</p>
            </section>
          )}

          <section className="xd-sect" id="availability">
            <h2>Availability &amp; booking</h2>
            <p className="xd-prose">Choose a preferred date, time and party size, and add it to your booking. You send everything as one request; the venue confirms your time. Live session availability opens as this venue publishes its calendar.</p>
          </section>
        </div>

        <aside className="xd-side">
          <div className="xd-card">
            {price && (
              <div className="xd-price">
                <span className="xd-price-amt">{price}</span>
                {e.duration_minutes ? <span className="xd-price-unit"> · {dur}</span> : null}
              </div>
            )}

            <ExperienceBooking
              id={e.id} name={e.name} basePrice={e.base_price} currency={e.currency}
              durationMinutes={e.duration_minutes} maxParticipants={e.max_participants}
              venueName={e.venue_name} venueId={e.venue_id} listingSlug={e.listing_slug}
              marketplace={e.marketplace} image={img} place={place}
            />

            {facts.length > 0 && (
              <dl className="xd-facts">
                {facts.map((f) => (
                  <div key={f.label} className="xd-fact">
                    <dt>{f.label}</dt><dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {venueHref && (
              <Link href={venueHref} className="xd-venue-link">View {e.venue_name} →</Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
