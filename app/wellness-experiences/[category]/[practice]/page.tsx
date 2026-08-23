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
    <>
      <section className="page-head">
        <div className="wrap">
          <nav className="tb-crumb" aria-label="Breadcrumb">
            <Link href="/wellness-experiences">Wellness experiences</Link>
            <span aria-hidden="true"> &rsaquo; </span>
            <Link href={`/wellness-experiences/${c.slug}`}>{c.name}</Link>
          </nav>
          <h1 style={{ marginTop: 'var(--s4)' }}>{p.name}</h1>
          {p.tagline && <p className="page-lead">{p.tagline}</p>}
          {paragraphs.length > 0 && (
            <div className="cat-lead">
              {paragraphs.map((para: string, i: number) => <p key={i}>{para}</p>)}
            </div>
          )}
          {p.description && <p className="page-sub">{p.description}</p>}
          <p className="page-sub" style={{ fontSize: 15, marginTop: 'var(--s3)' }}>
            {venues.length} venue{venues.length === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      <div className="wrap cat-body">
        <PracticeVenues venues={cards} practiceName={p.name} />
      </div>

      {facts.length > 0 && (
        <section className="cat-intro">
          <div className="wrap">
            <dl className="pr-glance">
              {facts.map((f: any, i: number) => (
                <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="cat-related">
          <div className="wrap">
            <h3>Related practices in {c.name}</h3>
            <div className="cat-pills">
              {related.map((s: any) => (
                <Link key={s.id} href={`/wellness-experiences/${c.slug}/${s.slug}`}>
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
