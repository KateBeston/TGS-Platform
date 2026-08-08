import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/venue/Section';

export const metadata: Metadata = {
  title: 'About us',
  description:
    'The Global Sanctum connects wellness guests and retreat hosts with curated '
    + 'venues worldwide. Our story, our values, and why we built it.',
  alternates: { canonical: '/about' },
};

const PROBLEM = [
  ['For wellness guests',
   'The full spectrum of wellness — traditional healing to modern modalities, sacred '
   + 'practices to therapeutic experiences — remained scattered. No unified place to '
   + 'find what exists globally.'],
  ['For retreat hosts',
   'Months of searching. Fragmented processes, bookings managed across several '
   + 'platforms. Time spent looking rather than designing.'],
  ['For venue owners',
   'Leads managed by hand that went nowhere. Hours answering enquiries that never '
   + 'converted. Administrative work consuming what should have been profit.'],
];

const VALUES = [
  ['Curated with intention',
   'Every venue is curated for its transformational qualities — spaces designed with '
   + 'intention, facilities created for genuine wellness work. You know what you are '
   + 'getting, every time.'],
  ['Built to serve',
   'Technology should handle what technology does well: bookings, calendars, payments, '
   + 'coordination. Simple where it should be, precise where precision matters.'],
  ['Transparency first',
   'Honest curation, accurate information, open communication about what each venue '
   + 'genuinely offers. No false promises. No inflated claims.'],
  ['Connection and community',
   'Transformation thrives through connection. We unite venue owners, retreat hosts '
   + 'and wellness guests in an ecosystem that serves all three.'],
  ['Global by design',
   'Wellness venues exist on every continent. We curate them — Scandinavia to South '
   + 'America, Southeast Asia to the Mediterranean, the Pacific to the Middle East.'],
  ['Elevating the industry',
   'Retreat venues and the transformational work happening within them deserve '
   + 'purpose-built infrastructure, not adapted systems.'],
];

export default function About() {
  return (
    <>
      <div className="lyv-hero">
        <img src="/images/about-hero.jpg" alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">Our story</div>
          <h1 className="hero-venue-name">About The Global Sanctum</h1>
        </div>
      </div>

      <Section tone="white" label="Wellness redefined"
        title="Connecting transformation">
        <div className="prose-narrow" style={{ textAlign: 'center' }}>
          <p className="prose-lead">
            The Global Sanctum connects wellness guests and retreat hosts with global
            wellness venues and retreat spaces.
          </p>
          <p>
            Where finding your sanctuary is effortless. Where booking your retreat is
            seamless. Where the full spectrum of wellness becomes discoverable.
          </p>
        </div>
      </Section>

      <Section tone="cream" label="The problem" title="What we saw"
        subtitle="The wellness industry had energy, intention and growth, but was missing the platform to support it.">
        <div className="lyv-gains">
          {PROBLEM.map(([title, body]) => (
            <div key={title} className="lyv-gain">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="white" label="The solution"
        title="One platform, everyone who creates transformation">
        <div className="prose-narrow">
          <p className="prose-lead">
            We built a platform where the full spectrum of wellness becomes discoverable.
          </p>
          <p>
            Traditional healing practices to modern modalities. Coastal sanctuaries to
            mountain temples, urban bathhouses to forest hideaways. Curated for depth
            rather than volume, with transparent information and coordination that holds.
          </p>
          <p>
            For retreat hosts, months of searching reduced to precision. For wellness
            guests, access to experiences that stayed hidden. For venue owners,
            technology that liberates rather than burdens.
          </p>
        </div>
      </Section>

      <div className="quote-banner">
        <img src="/images/about-quote.jpg" alt="" />
        <div className="hero-overlay" />
        <div className="quote-banner-content">
          <p>Just the first chapter. The story we are writing is much bigger than this.</p>
          <span>The Global Sanctum</span>
        </div>
      </div>

      <Section tone="white" label="The founder" title="A note from Kate">
        <div className="founder">
          <img src="/images/about-founder.jpg" alt="Kate Beston" />
          <div className="prose-narrow" style={{ margin: 0 }}>
            <p className="prose-lead">
              Everything I have done has converged in The Global Sanctum.
            </p>
            <p>
              Professionally I built expertise in real estate, property and mortgage
              broking — understanding how markets work, how spaces create value, and how
              infrastructure supports growth.
            </p>
            <p>
              This is where my experience, my values, and what this industry needs come
              together. We are just beginning.
            </p>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 19, fontStyle: 'italic' }}>
              — Kate
            </p>
          </div>
        </div>
      </Section>

      <Section tone="cream" label="What guides us" title="Our values">
        <div className="lyv-gains">
          {VALUES.map(([title, body]) => (
            <div key={title} className="lyv-gain">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="white">
        <div className="prose-narrow" style={{ textAlign: 'center' }}>
          <h2 className="section-title">Somewhere to begin</h2>
          <p>Two ways in, depending on what you are looking for.</p>
          <div style={{ display: 'flex', gap: 'var(--s3)', justifyContent: 'center',
                        flexWrap: 'wrap', marginTop: 'var(--s5)' }}>
            <Link className="btn-solid" href="/venues">Explore the venues</Link>
            <Link className="btn-line" href="/list-your-venue">List your venue</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
