import type { Metadata } from 'next';
import Link from 'next/link';
import PricingTable from '@/components/PricingTable';
import { Section } from '@/components/venue/Section';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/* The paid subscription page, parked.
 *
 * Not linked from anywhere, not in the sitemap, and noindex. It exists
 * so it can be swapped in when the complimentary period ends, and the
 * handover is explicit that it must not be deleted and must not be
 * surfaced.
 *
 * Every price is calculated from the database. Twelve prices at three
 * discount levels, plus twelve monthly equivalents, is twenty-four
 * numbers to keep in step by hand — and the audit already blames the
 * drift between the venues filter and the rest of the site on that.
 */

export const metadata: Metadata = {
  title: 'Venue subscriptions',
  // Parked. Indexing it would put the paid page in front of venues while
  // the complimentary period is still what is being offered.
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/list-your-venue-subscription' },
};

const GAINS = [
  ['Global visibility',
   'Reach retreat hosts, wellness guests and seekers actively searching for spaces like yours.'],
  ['Comprehensive profiles',
   'Everything that makes your space what it is — accommodation, facilities, offerings, setting, philosophy.'],
  ['Intelligent matching',
   'Search that connects the right guests to the right spaces. Filtered by modality, capacity, setting and amenities.'],
  ['Transparent fees',
   'Commission as low as 5%. Clear pricing, nothing hidden. You keep more of what you earn.'],
  ['Curated community',
   'Curation that protects your positioning among serious operators. Quality over volume, always.'],
  ['Operational tools',
   'Calendar management, enquiry handling and booking coordination, with a concierge behind all of it.'],
];

const STEPS = [
  ['Apply', 'Tell us about your venue. We read every application properly rather than filtering them.'],
  ['Onboard', 'We help build your profile — photography guidance, descriptions, facility mapping.'],
  ['Launch', 'Your venue goes live, discoverable by retreat hosts and wellness guests worldwide.'],
  ['Grow', 'Receive qualified enquiries and manage bookings through your dashboard.'],
];

export default async function Subscription() {
  const supabase = await createClient();

  const [{ data: pricing }, { data: current }, { data: programs }] = await Promise.all([
    supabase.from('partner_pricing').select('*')
      .order('program_order').order('tier_order'),
    supabase.rpc('current_partner_program'),
    supabase.from('partner_programs').select('*').eq('is_active', true)
      .order('display_order'),
  ]);

  const offering = (current as string | null) ?? 'standard-pricing';
  const rows = pricing ?? [];
  const partners = (programs ?? []).filter((p: any) => Number(p.discount_percent) > 0);

  // Places left in the programme being offered, so the page can say so
  // honestly rather than claiming a scarcity it cannot support.
  const left = rows.find((r: any) => r.program_slug === offering)?.places_left ?? null;

  return (
    <>
      <div className="lyv-hero">
        <img src="/images/lyv-hero.jpg" alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">Partner with us</div>
          <h1 className="hero-venue-name">List your venue</h1>
          <p className="lyv-hero-sub">
            Join a curated network of exceptional wellness and retreat venues.
          </p>
          <a className="btn-solid" href="#pricing"
            style={{ background: '#fff', color: 'var(--charcoal)', borderColor: '#fff' }}>
            View pricing
          </a>
        </div>
      </div>

      <Section tone="cream" label="What you gain" title="Built to serve your success">
        <div className="lyv-gains">
          {GAINS.map(([title, body]) => (
            <div key={title} className="lyv-gain">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="white" label="Simple process" title="How it works">
        <div className="lyv-steps">
          {STEPS.map(([title, body], i) => (
            <div key={title} className="lyv-step">
              <div className="lyv-step-n">{i + 1}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {!!partners.length && (
        <Section tone="cream" label="Early access" title="Partner pricing"
          subtitle="Rates offered once, to venues who join before the collection is built.">
          <div className="partner-cards">
            {partners.map((p: any) => {
              const places = rows.find((r: any) => r.program_slug === p.slug)?.places_left;
              const open = p.slug === offering;
              return (
                <div key={p.id} className={`partner-card ${open ? 'is-open' : ''}`}>
                  <div className="partner-badge">
                    {open
                      ? (places !== null && places !== undefined
                          ? `${places} of ${p.venue_cap} left`
                          : 'Open now')
                      : `After ${partners[0].name}s`}
                  </div>
                  <h3>{p.name}</h3>
                  <div className="partner-off">
                    <span className="partner-n">{Number(p.discount_percent)}</span>
                    <span className="partner-pct">% off</span>
                  </div>
                  {p.is_lifetime && (
                    <div className="partner-life">For as long as you stay</div>
                  )}
                  {p.description && <p className="partner-desc">{p.description}</p>}
                </div>
              );
            })}
          </div>
          <p className="lyv-fineprint">
            Applications are read individually. We are looking for venues aligned with
            a collection built on depth rather than volume.
          </p>
        </Section>
      )}

      <div id="pricing">
        <Section tone="white" label="Choose your plan" title="Simple subscriptions"
          subtitle="For retreat venues and wellness venues alike. Nothing hidden, and you can leave whenever you like.">
          <PricingTable rows={rows} offering={offering} placesLeft={left} />
        </Section>
      </div>

      <Section tone="cream">
        <div className="prose-narrow" style={{ textAlign: 'center' }}>
          <h2 className="section-title">Ready when you are</h2>
          <p>
            Applications take about ten minutes and cost nothing. We answer every one.
          </p>
          <div style={{ marginTop: 'var(--s5)' }}>
            <Link className="btn-solid" href="/list-your-venue">Apply to list your venue</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
