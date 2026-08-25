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
   'The Global Sanctum is a curated wellness and retreat platform \u2014 a collection of '
   + 'the world\u2019s wellness and retreat spaces organised by practice and purpose. You '
   + 'explore and search the collection, and our concierge is how bookings are managed. You '
   + 'tell us what you are seeking, we draw on thousands of spaces to send a short, personal '
   + 'selection chosen for you, and we handle the enquiry and every communication with the '
   + 'venue from beginning to end. It is a considered, personal way to book.'],
  ['What is the difference between a retreat venue and a wellness venue?',
   'A retreat venue is a space taken on an exclusive-use basis to hold a multi-day programme '
   + '\u2014 a yoga shala, a meditation centre, a nature lodge \u2014 the kind of place a '
   + 'retreat host books in full to gather their guests. A wellness venue is somewhere you go '
   + 'for the wellness itself: a day-use onsen or thermal spring, a healing centre, or a '
   + 'residential wellness hotel you check into. Put simply, a retreat venue is where a retreat '
   + 'is held; a wellness venue is where wellness is offered. Some spaces belong to both '
   + 'worlds, and each is clearly marked as you explore.'],
  ['I am a wellness guest \u2014 how do I find and book?',
   'Explore the collection by practice, place or purpose, and when something speaks to you, '
   + 'begin an enquiry. Our concierge takes it from there: we confirm availability, coordinate '
   + 'every detail with the venue, and stay with you from first enquiry through to your return. '
   + 'There is one relationship to manage rather than many, and it is with us.'],
  ['I am a retreat host \u2014 can you help me find a venue?',
   'Yes \u2014 this is much of what we do. Tell us the shape of your retreat: the practice, the '
   + 'dates, the number of guests, the setting you have in mind. We draw on the collection to '
   + 'send a considered selection of venues suited to your programme, and we handle the '
   + 'introductions and coordination so you can attend to the retreat itself rather than the '
   + 'logistics of the space.'],
  ['Can I contact a venue directly?',
   'The Global Sanctum acts as your single point of contact, coordinating directly with the '
   + 'venue on your behalf from your initial enquiry through to booking and beyond. It means one '
   + 'relationship to manage rather than many, with the details looked after for you.'],
  ['I have a venue \u2014 how do I list it?',
   'Visit our List Your Venue page or start an enquiry, and we will be in touch to learn about '
   + 'your space. There are no listing fees to join; a commission applies only on completed '
   + 'bookings we introduce, with subscription tiers rolling out in stages. Your venue takes its '
   + 'place in the collection, and we introduce it to the guests and hosts we serve.'],
];

export default async function Contact({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; intent?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: countries } = await supabase.from('countries').select('id,name,iso_code,dialling_code').order('name');
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
            <a className="contact-line" href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>
            <a className="contact-line" href="tel:+61735218067">+61 7 3521 8067</a>
            <span className="contact-tz">AEST (GMT+10)</span>
          </div>
          <div className="contact-card">
            <div className="feature-eyebrow">By Post</div>
            <h3>Our Address</h3>
            <p>
              Aurella Group Pty Ltd<br />
              58 Wellington Street<br />
              Virginia QLD 4014<br />
              Australia
            </p>
          </div>
          <div className="contact-card">
            <div className="feature-eyebrow">Opening Hours</div>
            <h3>When We are Available</h3>
            <p>Monday to Friday, 9:00am to 5:30pm AEST (GMT+10).</p>
            <p className="contact-hours-note">Outside these hours, email us and we&rsquo;ll respond within 24 to 48 hours.</p>
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
          <ContactForm sources={sources ?? []} countries={countries ?? []}
            prefill={{ role: sp.role, message: sp.intent }} />
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
