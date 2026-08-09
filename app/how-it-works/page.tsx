import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/venue/Section';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How The Global Sanctum connects wellness guests, retreat hosts and venue owners '
    + 'with exceptional spaces worldwide — a seamless experience from discovery to introduction.',
  alternates: { canonical: '/how-it-works' },
};

const JOURNEYS = [
  {
    who: 'For Wellness Guests',
    title: 'Find Your Sanctuary',
    steps: [
      ['Discover', 'Browse our curated collection of wellness venues and retreat spaces. Filter by location, experience type, amenities, and more to find your perfect match.'],
      ['Explore', 'View detailed venue profiles with high-resolution galleries, comprehensive facility information, services offered, and authentic reviews.'],
      ['Connect', 'Tell our concierge team what you are looking for. We help you check availability, ask the right questions, and narrow to venues that fit.'],
      ['Enquire', 'Send your enquiry and we take it from there, introducing you to the venue and coordinating the details through us. We do not take payment ourselves; payment is made to the venue and we help arrange it, with direct venue contact kept to on-site matters and emergencies.'],
    ],
    links: [['Browse Wellness Venues', '/venues?marketplace=Wellness'],
            ['Explore by Experience', '/wellness-experiences']],
  },
  {
    who: 'For Retreat Hosts',
    title: 'Host Your Transformation',
    steps: [
      ['Search', 'Find the perfect venue for your retreat program. Filter by capacity, facilities, location, and specific wellness modalities.'],
      ['Compare', 'Evaluate venues side by side. Review detailed information about spaces, accommodation, catering options, and past host reviews.'],
      ['Enquire', 'Submit your retreat requirements. Our team works with you and the venue to coordinate dates, group size, and special arrangements.'],
      ['Confirm', 'We introduce you to the venue and stay your point of contact as you finalise. Deposit and payment terms are the venue\u2019s own; we do not take payment ourselves, so we help coordinate it or arrange for you to pay the venue.'],
    ],
    links: [['Browse Retreat Venues', '/venues?marketplace=Retreat'],
            ['Request a Bespoke Search', '/contact']],
  },
  {
    who: 'For Venue Owners',
    title: 'Showcase Your Space',
    steps: [
      ['Apply', 'Submit your venue for review. We review every listing for quality and fit with our wellness community.'],
      ['Create', 'Build your comprehensive venue profile. Upload photos, describe your facilities, and highlight what makes your space unique.'],
      ['Connect', 'Receive qualified enquiries from the retreat hosts and guests we introduce, and we coordinate the correspondence and arrangements. You deal with them directly only for on-site details and emergencies, while we help coordinate payment to you.'],
      ['Grow', 'Manage your listing and enquiries through your dashboard. Keep your details current and build your reputation in the wellness community.'],
    ],
    links: [['List Your Venue', '/list-your-venue'],
            ['Speak With Our Team', '/contact']],
  },
];

const WHY = [
  ['Curated Excellence',
   'Every venue is personally reviewed. We prioritise quality over quantity, ensuring only exceptional spaces make it to our platform.'],
  ['Transparent Pricing',
   'No hidden fees. Clear commission structures. You always know exactly what you\u2019re paying for.'],
  ['Dedicated Support',
   'Our concierge team is here at every step, from finding the right venue to making the introduction.'],
  ['Community Driven',
   'Join a global network of wellness practitioners, retreat hosts, and seekers united by a passion for transformation.'],
];

export default function HowItWorks() {
  return (
    <>
      <div className="lyv-hero">
        <img src="/images/hiw-hero.jpg" alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">How It Works</div>
          <h1 className="hero-venue-name">Your Path with The Global Sanctum</h1>
          <p className="lyv-hero-sub">
            Discover how we connect wellness guests, retreat hosts, and venue owners with
            exceptional spaces worldwide. A seamless experience from discovery to introduction.
          </p>
        </div>
      </div>

      {JOURNEYS.map((j, i) => (
        <Section key={j.who} tone={i % 2 ? 'cream' : 'white'} label={j.who} title={j.title}>
          <div className="lyv-steps">
            {j.steps.map(([title, body], n) => (
              <div key={title} className="lyv-step">
                <div className="lyv-step-n">{n + 1}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--s3)', justifyContent: 'center',
            flexWrap: 'wrap', marginTop: 'var(--s6)' }}>
            {j.links.map(([label, href], n) => (
              <Link key={href} className={n === 0 ? 'btn-solid' : 'btn-line'} href={href}>
                {label}
              </Link>
            ))}
          </div>
        </Section>
      ))}

      <section className="hiw-why">
        <div className="wrap">
          <div className="hiw-why-head">
            <div className="intro-eyebrow">Our Difference</div>
            <h2 className="hiw-why-title">Why The Global Sanctum?</h2>
          </div>
          <div className="why-grid">
            {WHY.map(([title, body]) => (
              <div key={title} className="why-card">
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
