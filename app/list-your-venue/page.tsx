import type { Metadata } from 'next';
import { Section } from '@/components/venue/Section';
import VenueApplication from '@/components/VenueApplication';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'List your venue',
  description:
    'Apply to list your retreat venue or wellness space on The Global Sanctum. '
    + 'Curated, globally visible, and complimentary for your first six months.',
  alternates: { canonical: '/list-your-venue' },
};

/* The interim, concierge-phase page.
 *
 * This is the live /list-your-venue. The paid subscription page is
 * parked at /list-your-venue-subscription with noindex, no internal
 * links, and excluded from the sitemap — ready to swap in when the
 * complimentary period ends.
 *
 * The period runs from the day the platform goes live, not from a date
 * fixed in advance, so the page reads platform_milestones rather than
 * carrying a date that would be wrong the moment launch slipped.
 */

const PATHS = [
  {
    kind: 'Exclusive-use spaces',
    name: 'Retreat venues',
    image: '/images/lyv-retreat.jpg',
    blurb: 'Purpose-built centres, eco lodges, heritage properties and private estates '
         + 'that host transformational group programmes.',
    points: [
      'Connect with retreat hosts globally',
      'Show your full accommodation and facilities',
      'Receive qualified booking enquiries',
      'Calendar and availability, both directions',
      'Group booking coordination handled for you',
    ],
  },
  {
    kind: 'Sessions and multi-day',
    name: 'Wellness venues',
    image: '/images/lyv-wellness.jpg',
    blurb: 'Spas, bathhouses, thermal facilities, wellness centres and therapeutic '
         + 'spaces offering sessions, packages and treatments.',
    points: [
      'Reach guests seeking experiences, not rooms',
      'Display services, treatments and offerings',
      'Direct booking integration',
      'Visibility in curated collections',
      'Connection to a global wellness community',
    ],
  },
];

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
  ['Operational support',
   'Our concierge handles your enquiries and booking coordination today. Calendar management and self-serve booking are coming.'],
];

const STEPS = [
  ['Apply', 'Tell us about your venue. We read every application properly rather than filtering them.'],
  ['Onboard', 'We help build your profile — photography guidance, descriptions, facility mapping.'],
  ['Launch', 'Your venue goes live, discoverable by retreat hosts and wellness guests worldwide.'],
  ['Grow', 'Receive qualified enquiries hand-matched by our concierge.'],
];

const INCLUDED = [
  'A full venue profile in the collection',
  'A high-resolution photo gallery',
  'Video on your venue page',
  'Full detail on accommodation, facilities and philosophy',
  'Priority placement, shown first in search across your region',
  'A large feature card in the venues collection',
  'Home page feature rotation',
  'Visibility across our worldwide collection',
];

export default async function ListYourVenue() {
  const supabase = await createClient();

  const [{ data: types }, { data: categories }, { data: period }] = await Promise.all([
    supabase.from('venue_types').select('id,name,applies_to').order('name'),
    supabase.from('modality_categories').select('id,name,in_retreat')
      .eq('in_retreat', true).order('display_order'),
    supabase.rpc('complimentary_period'),
  ]);

  const p = (period ?? {}) as Record<string, any>;

  return (
    <>
      <div className="lyv-hero">
        <img src="/images/lyv-hero.jpg" alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">Partner with us</div>
          <h1 className="hero-venue-name">List your venue</h1>
          <p className="lyv-hero-sub">
            A curated collection of retreat spaces and wellness venues, and the
            people looking for them.
          </p>
          <a className="btn-solid" href="#apply" style={{ background: '#fff',
              color: 'var(--charcoal)', borderColor: '#fff' }}>
            Apply to list your venue
          </a>
        </div>
      </div>

      <Section tone="white" label="Two paths, one platform"
        title="For every kind of wellness space">
        <div className="lyv-paths">
          {PATHS.map((path) => (
            <article key={path.name} className="lyv-path">
              <img src={path.image} alt="" />
              <div className="lyv-path-body">
                <div className="feature-eyebrow">{path.kind}</div>
                <h3 className="feature-title">{path.name}</h3>
                <p className="feature-body">{path.blurb}</p>
                <ul className="lyv-points">
                  {path.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </Section>

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

      <Section tone="cream"
        label={p.live ? 'Complimentary' : 'Your first six months'}
        title={p.live ? (p.in_words as string) : 'Your first six months, free'}
        subtitle="Everything a Featured listing includes, at no cost">
        <div className="lyv-included">
          {INCLUDED.map((i) => <div key={i} className="lyv-included-item">{i}</div>)}
        </div>
        <p className="lyv-fineprint">
          {p.live
            ? `The complimentary period runs to ${p.ends_on}. After that, listings move to
               the published subscription tiers and nothing changes without us telling you first.`
            : `The six months begins when the platform goes public, not from the day you
               apply — so applying early costs you none of it.`}
        </p>
      </Section>

      <div id="apply">
        <Section tone="white" label="Apply" title="Tell us about your venue"
          subtitle="Six short steps. You can go back and change anything before you send it.">
          <VenueApplication venueTypes={types ?? []} categories={categories ?? []} />
        </Section>
      </div>
    </>
  );
}
