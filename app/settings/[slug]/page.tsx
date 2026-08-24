import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { settingBySlug, venuesForSetting, settings } from '@/lib/settings';
import ExperienceResults from '@/components/ExperienceResults';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const s = await settingBySlug(slug);
  if (!s) return { title: 'Setting — The Global Sanctum' };
  return {
    title: s.meta_title || `${s.name} retreats and wellness venues — The Global Sanctum`,
    description: s.meta_description || s.description || undefined,
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const s = await settingBySlug(slug);
  if (!s) notFound();
  const [venues, all] = await Promise.all([venuesForSetting(s.id), settings()]);
  const related = all.filter((x) => x.slug !== s.slug && x.category === s.category).slice(0, 6);

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb"><Link href="/settings">Settings</Link></div>
          <h1 style={{ marginTop: 'var(--s4)' }}>{s.name}</h1>
          {s.tagline && <p className="page-lead">{s.tagline}</p>}
          {s.intro && (
            <div className="cat-lead">
              {s.intro.split(/\n+/).filter((x) => x.trim()).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
          {s.description && <p className="cat-desc">{s.description}</p>}
          <p className="page-sub" style={{ fontSize: 15, marginTop: 'var(--s3)' }}>
            {venues.length} venue{venues.length === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      <div className="wrap cat-body">
        {venues.length > 0
          ? <ExperienceResults venues={venues} practices={new Map()} />
          : <p className="page-sub">We&rsquo;re curating venues in this setting. Explore other settings below in the meantime.</p>}
      </div>

      {related.length > 0 && (
        <section className="cat-related">
          <div className="wrap">
            <h3>More {(s.category ?? 'related').toLowerCase()} settings</h3>
            <div className="cat-pills">
              {related.map((r) => <Link key={r.id} href={`/settings/${r.slug}`}>{r.name}</Link>)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
