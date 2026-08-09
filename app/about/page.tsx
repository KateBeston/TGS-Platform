import type { Metadata } from 'next';
import { Section } from '@/components/venue/Section';

export const metadata: Metadata = {
  title: 'About us',
  description:
    'The Global Sanctum is the premier platform connecting wellness guests and '
    + 'retreat hosts with global wellness venues and retreat spaces. Our story, '
    + 'our vision, and the values that guide us.',
  alternates: { canonical: '/about' },
};

const PROBLEM = [
  ['For Wellness Guests',
   'The full spectrum of wellness, from traditional healing to modern modalities and '
   + 'sacred practices to therapeutic experiences, remained scattered. No unified place '
   + 'to find what exists globally.'],
  ['For Retreat Hosts',
   'Months of searching. Navigating fragmented processes, managing bookings across '
   + 'multiple platforms. Time spent searching instead of designing transformational '
   + 'experiences.'],
  ['For Venue Owners',
   'Manually managing leads that went nowhere. Revenue leaking through lost time and '
   + 'disjointed systems. Hours spent answering enquiries that never converted. '
   + 'Administrative work consuming what should have been profit.'],
];

const VALUES = [
  ['\u25C7', 'Curated With Intention',
   'Every venue listed with The Global Sanctum is curated for its transformational '
   + 'qualities, spaces designed with intention, facilities created for genuine wellness '
   + 'work. We curate for intentionality. You know what you\u2019re getting every time.'],
  ['\u25C8', 'Built To Serve',
   'Technology should handle what technology does well, bookings, calendars, payments, '
   + 'and coordination, freeing everyone to focus on what matters. Simple where it should '
   + 'be. Precise where precision matters.'],
  ['\u25CE', 'Transparency First',
   'Transparency shapes everything we do. Honest curation, accurate information, open '
   + 'communication about what each venue genuinely offers. No false promises. No inflated '
   + 'claims. Just integrity.'],
  ['\u2B22', 'Connection & Community',
   'Transformation thrives through connection. We unite venue owners, retreat hosts, and '
   + 'wellness guests in an ecosystem serving everyone. Genuine community. Shared success. '
   + 'Better together.'],
  ['\u25C9', 'Global By Design',
   'Wellness and retreat venues exist across every continent. We curate them, from '
   + 'Scandinavia to South America, Southeast Asia to the Mediterranean, the Pacific to '
   + 'the Middle East. Access to authentic wellness globally. One platform.'],
  ['\u2605', 'Elevating The Industry',
   'Retreat venues, wellness facilities, and the transformational work happening within '
   + 'them deserve world-class infrastructure. Not adapted systems, but purpose-built '
   + 'technology. Excellence as baseline. Quality as expectation.'],
];

export default function About() {
  return (
    <>
      <div className="lyv-hero">
        <img src="/images/about-hero.jpg" alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">Our Story</div>
          <h1 className="hero-venue-name">About The Global Sanctum</h1>
        </div>
      </div>

      <Section tone="white" label="Wellness Redefined"
        title="The Premier Platform Connecting Transformation">
        <div className="prose-narrow" style={{ textAlign: 'center' }}>
          <p className="prose-lead">
            The Global Sanctum is the premier platform connecting wellness guests and
            retreat hosts with global wellness venues and retreat spaces.
          </p>
          <p>
            Where finding your sanctuary is effortless. Where booking your retreat is
            seamless. Where the full spectrum of wellness becomes discoverable.
          </p>
        </div>
      </Section>

      <Section tone="cream">
        <div className="problem-grid">
          <div className="problem-intro">
            <h2 className="section-title">The Problem We Saw</h2>
            <p>The wellness industry had energy, intention, and growth, but was missing the platform to support it.</p>
          </div>
          <div className="problem-cards">
            {PROBLEM.map(([title, body]) => (
              <div key={title} className="problem-card">
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="white" label="The Solution"
        title="One Platform Connecting Everyone Who Creates Transformation">
        <div className="prose-narrow">
          <p className="prose-lead">
            The Global Sanctum exists to solve this. We built a platform where the full
            spectrum of wellness becomes discoverable.
          </p>
          <p>
            Traditional healing practices to modern modalities. Coastal sanctuaries to
            mountain temples, urban bathhouses to forest hideaways. Curated for depth, not
            volume. Transparent information, trusted bookings, seamless coordination.
          </p>
          <p>
            For retreat hosts, months of searching reduced to precision. For wellness
            guests, access to experiences that remained hidden, now authenticated, curated,
            and gathered in one place. For venue owners, technology that liberates instead
            of burdens.
          </p>
        </div>
      </Section>

      <Section tone="cream">
        <div className="vision-mission">
          <div className="vm-card">
            <h3>Our Vision</h3>
            <p>
              A platform where wellness venues and experiences become discoverable.
              Traditional practices alongside modern modalities, from Japanese onsens to
              Ayurvedic centres, forest temples to coastal facilities. Simple search,
              seamless booking.
            </p>
            <p>
              Venue owners with technology handling operations, bookings, calendars, and
              payments, so they can focus on creating sanctuary. Hosts finding what their
              retreats need with clarity and confidence. Wellness guests accessing the full
              spectrum of wellness, gathered in one place.
            </p>
          </div>
          <div className="vm-card">
            <h3>Our Mission</h3>
            <p>
              We exist to make wellness accessible to everyone seeking transformation, and
              to support everyone creating it. We gather wellness venues and experiences
              globally.
            </p>
            <p>
              Traditional practices honoured for centuries alongside modern modalities
              advancing today. Retreat centres, healing sanctuaries, and therapeutic spaces,
              brought into one place where they can be found. We serve three communities
              equally, building infrastructure this industry needs to flourish.
            </p>
          </div>
        </div>
      </Section>

      <div className="quote-banner">
        <img src="/images/about-quote.jpg" alt="" />
        <div className="hero-overlay" />
        <div className="quote-banner-content">
          <p>Just the first chapter. The story we&rsquo;re writing is much bigger than this.</p>
          <span>The Global Sanctum</span>
        </div>
      </div>

      <Section tone="white" label="The Founder" title="A Note From Kate">
        <div className="founder">
          <img src="/images/about-founder.jpg" alt="Kate Beston, Founder of The Global Sanctum" />
          <div className="prose-narrow" style={{ margin: 0 }}>
            <p className="prose-lead">
              Everything I&rsquo;ve experienced has converged in The Global Sanctum.
            </p>
            <p>
              Professionally, I built expertise in real estate, property, and mortgage
              broking, understanding how markets work, how spaces create value, how
              infrastructure supports growth.
            </p>
            <p>
              Personally, I walked my own path through life coaching, spiritual practice,
              and personal development. That experience taught me the power of
              transformation, not just from the spaces we inhabit, but from the
              facilitators, hosts, and coaches who guide the work. Both matter profoundly.
            </p>
            <p>
              The Global Sanctum is where these paths align. My professional background
              meeting my values and personal story. Real estate knowledge applied to an
              industry I genuinely care about. Infrastructure that serves spaces designed
              for transformation and the people leading that transformation.
            </p>
            <p>
              This is where my experience, my values, and what this industry needs come
              together.
            </p>
            <p>We&rsquo;re just beginning.</p>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 19, fontStyle: 'italic' }}>
              &mdash; Kate
            </p>
          </div>
        </div>
      </Section>

      <Section tone="cream" label="What Guides Us" title="Our Values">
        <div className="values-grid">
          {VALUES.map(([symbol, title, body]) => (
            <div key={title} className="value-card">
              <div className="value-symbol" aria-hidden="true">{symbol}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
