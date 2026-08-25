import type { Metadata } from 'next';
import { Section } from '@/components/venue/Section';
import ListVenueCta from '@/components/ListVenueCta';
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

const VMS_FEATURES = [
  ['Your listing, in your hands',
   'Build and edit your venue profile, photography, services and availability. Every change is reviewed by our team before it goes live.'],
  ['Bookings, start to finish',
   'See every booking request, confirm or offer alternative dates, and manage changes, all in one considered view.'],
  ['Payouts direct to you',
   'Connected securely through Stripe, your earnings flow straight to your own account. We take only our agreed commission.'],
  ['Availability and seasons',
   'Set your open dates, seasons and rates, with two-way calendar management arriving soon.'],
  ['Account and security',
   'Two-factor protection, considered access for your team, and full control of your own details.'],
  ['Your subscription',
   'View your tier, understand your commission, and move between plans whenever it suits you.'],
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

  const { data: period } = await supabase.rpc('complimentary_period');

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
          <ListVenueCta className="btn-solid" style={{ background: '#fff',
              color: 'var(--charcoal)', borderColor: '#fff' }}
              label="Apply to list your venue" />
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

      <div className="lyv-cta-row">
        <ListVenueCta className="btn-solid" label="Apply to list your venue" />
      </div>

      <Section tone="charcoal" label="Sanctum VMS"
        title="Your venue, managed in one considered place"
        subtitle="Every partner is given Sanctum VMS, your private portal for listing, bookings, payouts and everything in between">
        <div className="lyv-vms">
          {VMS_FEATURES.map(([title, body]) => (
            <div key={title} className="lyv-vms-item">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
        <div className="lyv-cta-row">
          <ListVenueCta className="btn-solid" style={{ background: '#fff', color: 'var(--charcoal)', borderColor: '#fff' }}
            label="Create your venue account" />
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
        <div className="lyv-cta-row">
          <ListVenueCta className="btn-solid" label="Start your application" />
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

      <section className="lyv-close">
        <div className="lyv-close-inner">
          <div className="hero-eyebrow">Begin</div>
          <h2 className="lyv-close-title">List your venue with The Global Sanctum</h2>
          <p className="lyv-close-sub">
            Create your account, tell us about your space, and join a curated
            collection of the world&rsquo;s most considered retreat and wellness venues.
          </p>
          <ListVenueCta className="btn-solid" style={{ background: '#fff', color: 'var(--charcoal)', borderColor: '#fff' }}
            label="Apply to list your venue" />
          <p className="lyv-close-alt">
            Already a partner? <a href="https://vms.theglobalsanctum.com/login">Sign in to Sanctum VMS</a>
          </p>
        </div>
      </section>

    </>
  );
}
