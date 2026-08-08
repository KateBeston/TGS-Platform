import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/venue/Section';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How The Global Sanctum connects wellness guests, retreat hosts and venue owners '
    + 'with exceptional spaces worldwide — from discovery to introduction.',
  alternates: { canonical: '/how-it-works' },
};

/* Three journeys, because three people arrive here.
 *
 * The wording on the retreat host and venue owner paths is deliberately
 * plain about what TGS does and does not do: we introduce and coordinate,
 * the venue's terms are its own, and payment is arranged rather than
 * taken. Saying it here is cheaper than saying it during a dispute. */

const JOURNEYS = [
  {
    who: 'For wellness guests',
    title: 'Find your sanctuary',
    steps: [
      ['Discover', 'Browse the collection. Filter by place, setting, modality and what a venue actually holds.'],
      ['Explore', 'Full venue profiles — galleries, facilities, what is offered, and reviews from people who booked.'],
      ['Connect', 'Tell our concierge what you are looking for. We check availability, ask the right questions, and narrow it down.'],
      ['Enquire', 'One enquiry, and we take it from there. Nothing is charged and nothing is committed.'],
    ],
    links: [['Browse wellness venues', '/venues?marketplace=Wellness'],
            ['Explore by experience', '/wellness-experiences']],
  },
  {
    who: 'For retreat hosts',
    title: 'Host your transformation',
    steps: [
      ['Search', 'Find a venue for your programme. Filter by capacity, spaces, location and modality.'],
      ['Compare', 'Evaluate side by side — spaces, accommodation, catering, and what other hosts said.'],
      ['Enquire', 'Tell us your requirements. We work with you and the venue on dates, group size and arrangements.'],
      ['Confirm', 'We introduce you and stay your point of contact. Deposit and payment terms are the venue\u2019s own — we do not take payment ourselves, so we coordinate it or arrange for you to pay the venue directly.'],
    ],
    links: [['Browse retreat venues', '/venues?marketplace=Retreat'],
            ['Request a bespoke search', '/contact']],
  },
  {
    who: 'For venue owners',
    title: 'Showcase your space',
    steps: [
      ['Apply', 'Submit your venue. We read every application properly rather than filtering them.'],
      ['Create', 'Build your profile — photographs, facilities, and what makes the place what it is.'],
      ['Connect', 'Receive qualified enquiries from hosts and guests we introduce. We coordinate the correspondence; you deal with them directly for on-site details.'],
      ['Grow', 'Keep your details current and build your standing in the community.'],
    ],
    links: [['List your venue', '/list-your-venue'],
            ['Speak with our team', '/contact']],
  },
];

const WHY = [
  ['Curated excellence',
   'Every venue is reviewed by a person. Quality over quantity, and that is not a slogan — it is why the collection is smaller than it could be.'],
  ['Transparent pricing',
   'Clear commission, nothing hidden. You always know what you are paying for.'],
  ['One point of contact',
   'A concierge who knows both sides. Not a form that disappears into an inbox.'],
];

export default function HowItWorks() {
  return (
    <>
      <div className="lyv-hero">
        <img src="/images/hiw-hero.jpg" alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">How it works</div>
          <h1 className="hero-venue-name">Your path with The Global Sanctum</h1>
          <p className="lyv-hero-sub">
            How we connect wellness guests, retreat hosts and venue owners with
            exceptional spaces worldwide.
          </p>
        </div>
      </div>

      {JOURNEYS.map((j, i) => (
        <Section key={j.who} tone={i % 2 ? 'cream' : 'white'}
          label={j.who} title={j.title}>
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

      <Section tone="white" label="Our difference" title="Why The Global Sanctum">
        <div className="lyv-gains">
          {WHY.map(([title, body]) => (
            <div key={title} className="lyv-gain">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
