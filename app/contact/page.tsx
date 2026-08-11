import type { Metadata } from 'next';
import Link from 'next/link';
import ContactForm from '@/components/ContactForm';
import { Section } from '@/components/venue/Section';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Whether you are a wellness guest, a retreat host, or a venue owner — questions '
    + 'about the platform, a venue, or listing your own space. We are here to help.',
  alternates: { canonical: '/contact' },
};

const PATHS = [
  ['\u25EF', 'Wellness Guests',
   'Seeking a transformative retreat or wellness experience? Let us help you find the '
   + 'perfect sanctuary tailored to you.',
   'Get in Touch', '#send-message'],
  ['\u25C7', 'Retreat Hosts',
   'Looking for the ideal venue for your next retreat or program? We curate spaces '
   + 'designed for meaningful facilitation.',
   'Find Your Venue', '/venues'],
  ['\u2B22', 'Venue Owners',
   'Ready to showcase your property to a global audience of wellness guests and retreat '
   + 'hosts? We\u2019d love to welcome you.',
   'List Your Venue', '/list-your-venue'],
];

const FAQ = [
  ['How does The Global Sanctum work?',
   'The Global Sanctum is a curated wellness and retreat platform, a collection of the '
   + 'world\u2019s wellness and retreat spaces organised by practice and purpose. You can '
   + 'explore and search our curated collection, and our concierge is how bookings are '
   + 'managed. You tell us what you are seeking, we draw on more than 6,000 spaces to send '
   + 'a short, personal selection chosen for you, and we handle the enquiry and all '
   + 'communication with the venue from beginning to end. It is a considered, personal way '
   + 'to book.'],
  ['What types of venues are listed?',
   'We feature two categories: retreat venues for exclusive-use multi-day programs '
   + 'including yoga shalas, meditation centres, and nature lodges; and wellness venues '
   + 'encompassing everything from day-use therapeutic facilities such as onsens, thermal '
   + 'springs, and healing centres through to multi-day wellness hotels and residential '
   + 'wellness properties.'],
  ['How do I list my venue?',
   'Visit our List Your Venue page or start an enquiry, and we will be in touch to learn '
   + 'about your space. Your venue takes its place in the collection, and we introduce it '
   + 'to the guests and hosts we serve. Our concierge manages the enquiries and '
   + 'introductions from first contact through to booking.'],
  ['What are the fees for venue owners?',
   'Partnership currently works as a referral model: there are no listing fees to join, '
   + 'and a commission applies only on completed bookings we introduce. Subscription '
   + 'tiers, each with its own commission structure, are introduced in stages as our paid '
   + 'partnership options roll out. You can read more on our List Your Venue page.'],
  ['Can I contact a venue directly?',
   'The Global Sanctum acts as your single point of contact, coordinating directly with '
   + 'the venue on your behalf from your initial enquiry through to booking and beyond. It '
   + 'means one relationship to manage rather than many, with the details looked after for '
   + 'you.'],
];

export default async function Contact() {
  const supabase = await createClient();
  const { data: sources } = await supabase.from('lead_sources')
    .select('name,slug').eq('is_active', true).order('display_order');

  return (
    <>
      <Section tone="cream" label="Get In Touch"
        title="We&rsquo;d Love to Hear From You"
        subtitle="Whether you&rsquo;re a wellness guest seeking your next sanctuary, a retreat host searching for the perfect venue, or a venue owner ready to connect with a global audience, we&rsquo;re here to help.">
        <div className="contact-cards">
          <div className="contact-card">
            <div className="feature-eyebrow">General Enquiries</div>
            <h3>Start a Conversation</h3>
            <p>We welcome questions about our platform, partnerships, and services.</p>
            <a href="mailto:hello@theglobalsanctum.com">Reach us directly at hello@theglobalsanctum.com</a>
          </div>
          <div className="contact-card">
            <div className="feature-eyebrow">Opening Hours</div>
            <h3>When We are Available</h3>
            <p>Monday to Friday, 9:00am to 5:30pm AEST.</p>
          </div>
          <div className="contact-card">
            <div className="feature-eyebrow">For Venue Owners</div>
            <h3>List Your Venue</h3>
            <p>
              Interested in showcasing your retreat or wellness venue to a global audience
              of discerning wellness guests and retreat hosts?
            </p>
            <Link href="/list-your-venue">Learn more about partnering with us</Link>
          </div>
          <div className="contact-card" id="press-media" style={{ scrollMarginTop: 90 }}>
            <div className="feature-eyebrow">Press &amp; Media</div>
            <h3>Media Enquiries</h3>
            <p>
              For press enquiries, interviews, or collaboration opportunities, please
              contact <a href="mailto:press@theglobalsanctum.com">press@theglobalsanctum.com</a>
            </p>
          </div>
        </div>
        <div className="response-note">
          <span className="response-note-mark" aria-hidden="true">&#9672;</span>
          <p>
            Our team typically responds within 24&ndash;48 hours during business days. For
            urgent matters, please note this in your message subject line.
          </p>
        </div>
      </Section>

      <div id="send-message">
        <Section tone="white" title="Send Us a Message"
          subtitle="All fields marked with an asterisk are required.">
          <ContactForm sources={sources ?? []} />
        </Section>
      </div>

      <Section tone="cream" label="How Can We Help" title="Choose Your Path">
        <div className="choose-grid">
          {PATHS.map(([symbol, title, body, cta, href]) => (
            <div key={title} className="choose-card">
              <div className="value-symbol" aria-hidden="true">{symbol}</div>
              <h3>{title}</h3>
              <p>{body}</p>
              <Link className="choose-cta" href={href}>{cta} &rarr;</Link>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="white" label="Common Questions" title="Frequently Asked">
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q} className="faq-item">
              <summary className="faq-question">
                <span>{q}</span>
                <span className="faq-toggle" aria-hidden="true" />
              </summary>
              <div className="faq-answer"><p>{a}</p></div>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
