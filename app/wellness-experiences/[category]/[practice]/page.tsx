import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PracticeVenues from '@/components/PracticeVenues';
import { categoryBySlug, practiceBySlug, practicesIn, venuesFor, servicesForPractice } from '@/lib/experiences';
import { placeOf, venueHref } from '@/lib/venues';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ category: string; practice: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category, practice } = await params;
  const p = await practiceBySlug(category, practice);
  if (!p) return { title: 'Not found' };
  return {
    title: `${p.name} — venues and retreats`,
    description: p.description
      ?? `Venues offering ${p.name.toLowerCase()}, curated from around the world.`,
    alternates: { canonical: `/wellness-experiences/${category}/${p.slug}` },
  };
}

export default async function PracticePage({ params }: Params) {
  const { category, practice } = await params;
  const [c, p] = await Promise.all([
    categoryBySlug(category), practiceBySlug(category, practice),
  ]);
  if (!c || !p) notFound();

  const [siblings, venues, services] = await Promise.all([
    practicesIn(c.id),
    venuesFor({ practiceId: p.id }),
    servicesForPractice(p.id),
  ]);

  const facts = Array.isArray(p.at_a_glance) ? p.at_a_glance : [];
  const paragraphs = ((p.intro ?? '') as string)
    .split(/\n{2,}|\r\n{2,}/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  const cards = venues.map((v: any) => ({ ...v, place: placeOf(v), href: venueHref(v), service: services.get(v.id) ?? null }));

  const related = siblings.filter((s: any) => s.id !== p.id);

  return (
    <div className="pr-page">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> &rsaquo; </span>
          <Link href="/wellness-experiences">Wellness Experiences</Link>
          <span aria-hidden="true"> &rsaquo; </span>
          <Link href={`/wellness-experiences/${c.slug}`}>{c.name}</Link>
          <span aria-hidden="true"> &rsaquo; </span>
          <span className="crumb-current">{p.name}</span>
        </nav>
      </div>

      <section className="intro">
        <div className="wrap">
          <div className={facts.length ? 'intro-grid' : ''}>
            <div className="intro-main">
              <p className="eyebrow">{c.name}</p>
              <h1>{p.name}</h1>
              {p.description && <p className="intro-standfirst">{p.description}</p>}
              {paragraphs.map((para: string, i: number) => <p key={i}>{para}</p>)}
            </div>
            {facts.length > 0 && (
              <aside className="intro-aside">
                <h4>At a glance</h4>
                <dl>
                  {facts.map((f: any, i: number) => (
                    <div key={i}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </aside>
            )}
          </div>
        </div>
      </section>

      <PracticeVenues venues={cards} practiceName={p.name} />

      {related.length > 0 && (
        <section className="related">
          <div className="wrap">
            <h3>Related practices in {c.name}</h3>
            <div className="pills">
              {related.map((s: any) => (
                <Link key={s.id} href={`/wellness-experiences/${c.slug}/${s.slug}`}>
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
