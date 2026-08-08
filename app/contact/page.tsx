import type { Metadata } from 'next';
import Link from 'next/link';
import ContactForm from '@/components/ContactForm';
import { Section } from '@/components/venue/Section';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Questions about the platform, a venue, or listing your own space. '
    + 'We answer within a day or two.',
  alternates: { canonical: '/contact' },
};

export default async function Contact() {
  const supabase = await createClient();
  const { data: sources } = await supabase.from('lead_sources')
    .select('name,slug').eq('is_active', true).order('display_order');

  return (
    <>
      <Section tone="cream" label="Get in touch"
        title="We would love to hear from you"
        subtitle="Whether you are seeking somewhere to go, a venue to run something in, or you have a space of your own.">
        <div className="contact-cards">
          <div className="contact-card">
            <div className="feature-eyebrow">General enquiries</div>
            <h3>Start a conversation</h3>
            <p>Questions about the platform, partnerships, or anything else.</p>
            <a href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>
          </div>

          <div className="contact-card">
            <div className="feature-eyebrow">When we are available</div>
            <h3>Opening hours</h3>
            <p>Monday to Friday, 9:00am to 5:30pm AEST.</p>
            <p className="muted-small">
              We answer within a day or two. If something is urgent, say so in the
              subject and we will move faster.
            </p>
          </div>

          <div className="contact-card">
            <div className="feature-eyebrow">For venue owners</div>
            <h3>List your venue</h3>
            <p>
              Interested in showing your retreat or wellness venue to a global
              audience?
            </p>
            <Link href="/list-your-venue">Learn about partnering with us</Link>
          </div>

          <div className="contact-card">
            <div className="feature-eyebrow">Press and media</div>
            <h3>Media enquiries</h3>
            <p>For press, interviews or collaboration.</p>
            <a href="mailto:press@theglobalsanctum.com">press@theglobalsanctum.com</a>
          </div>
        </div>
      </Section>

      <Section tone="white" label="Send us a message"
        title="Tell us what you need"
        subtitle="A few fields, and the more you tell us the better the answer.">
        <ContactForm sources={sources ?? []} />
      </Section>
    </>
  );
}
