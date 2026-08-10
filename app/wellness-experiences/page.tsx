import type { Metadata } from 'next';
import { categories } from '@/lib/experiences';
import { createClient } from '@/lib/supabase/server';
import ExperienceAccordion from '@/components/ExperienceAccordion';
import JournalSignup from '@/components/JournalSignup';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wellness experiences',
  description:
    'Browse transformative modalities and healing practices. Each links directly '
    + 'to venues in our collection that offer them.',
  alternates: { canonical: '/wellness-experiences' },
};

export default async function ExperiencesPage() {
  const supabase = await createClient();
  const [cats, { data: allPractices }] = await Promise.all([
    categories(),
    supabase.from('experience_practices')
      .select('name,slug,category_slug,venue_count')
      .order('display_order', { nullsFirst: false })
      .order('name'),
  ]);

  const byCategory = new Map<string, any[]>();
  for (const p of (allPractices ?? []) as any[]) {
    const list = byCategory.get(p.category_slug) ?? [];
    list.push(p);
    byCategory.set(p.category_slug, list);
  }

  const withPractices = cats.map((c: any) => ({
    ...c,
    image_url: c.hero_image_url ?? null,
    practices: byCategory.get(c.slug) ?? [],
  }));

  const categoryCount = withPractices.length;
  const practiceCount = (allPractices ?? []).length;

  return (
    <div className="we-page">
      <section className="hero">
        <div className="hero-img" aria-hidden="true" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-left">
            <div className="hero-eyebrow">Modalities &amp; Practices</div>
            <h1 className="hero-title">Explore by <em>Experience.</em></h1>
          </div>
          <p className="hero-body">
            Browse transformative modalities and healing practices. Each links
            directly to venues that offer them, so you find the right space for the
            experience you&rsquo;re seeking.
          </p>
        </div>
      </section>

      <section className="intro-bar">
        <p className="intro-bar-text">
          Select a category to explore. Each practice links to venues in our
          collection offering that modality.
        </p>
        <p className="intro-bar-count">
          {categoryCount} categories&nbsp;&middot;&nbsp;{practiceCount} practices
        </p>
      </section>

      <ExperienceAccordion categories={withPractices} />

      <section className="info-strip">
        <div className="info-cell">
          <div className="info-cell-eyebrow">How it works</div>
          <h2 className="info-cell-heading">Browse by modality, find your venue.</h2>
          <p className="info-cell-body">
            Each practice links directly to venues in our collection offering that
            modality. No duplication &mdash; the experience lives at the venue.
          </p>
        </div>
        <div className="info-cell">
          <div className="info-cell-eyebrow">Can&rsquo;t find your practice?</div>
          <h2 className="info-cell-heading">We&rsquo;re always expanding the collection.</h2>
          <p className="info-cell-body">
            If your modality isn&rsquo;t listed here, reach out and we&rsquo;ll help
            you find the right space for your specific needs.
          </p>
        </div>
      </section>

      <JournalSignup source="wellness-experiences" />
    </div>
  );
}
