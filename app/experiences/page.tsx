import type { Metadata } from 'next';
import Link from 'next/link';
import { listExperiences, experienceCategories } from '@/lib/bookingExperiences';
import ExperienceCard from '@/components/experiences/ExperienceCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wellness Experiences — The Global Sanctum',
  description:
    'Book treatments, sessions and wellness experiences at curated venues around the world. Reserve a time, gift an experience, or add it to a retreat.',
};

type Search = Promise<{ category?: string; country?: string }>;

export default async function ExperiencesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const [{ experiences }, cats] = await Promise.all([
    listExperiences({ category: sp.category, country: sp.country }),
    experienceCategories(),
  ]);

  return (
    <div className="xp-page">
      <header className="xp-head">
        <div className="xp-head-eyebrow">Wellness Experiences</div>
        <h1 className="xp-head-title">Reserve a wellness experience</h1>
        <p className="xp-head-sub">
          Treatments, sessions and rituals at curated venues around the world. Choose a time, gift an
          experience, or weave one into your retreat.
        </p>
      </header>

      {cats.length > 0 && (
        <nav className="xp-filters" aria-label="Filter by category">
          <Link href="/experiences" className={`xp-filter${!sp.category ? ' on' : ''}`}>All</Link>
          {cats.map((c) => (
            <Link key={c.slug} href={`/experiences?category=${c.slug}`}
              className={`xp-filter${sp.category === c.slug ? ' on' : ''}`}>{c.name}</Link>
          ))}
        </nav>
      )}

      {experiences.length === 0 ? (
        <div className="xp-empty">No experiences here yet. New ones are added as venues open their calendars.</div>
      ) : (
        <div className="xp-grid">
          {experiences.map((e) => <ExperienceCard key={e.id} e={e} />)}
        </div>
      )}
    </div>
  );
}
