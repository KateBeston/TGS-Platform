import type { Metadata } from 'next';
import Link from 'next/link';
import HomeSearch from '@/components/HomeSearch';
import { placeOf, venueHref, type Card } from '@/lib/venues';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Global Sanctum — curated retreat venues and wellness sanctuaries worldwide',
  description:
    'Discover exceptional retreat venues and wellness sanctuaries around the world. '
    + 'Curated for depth rather than volume.',
  alternates: { canonical: '/' },
};

/* The home page.
 *
 * Built from tgs_home_v6 — hero with search, the two paths, settings
 * mosaic, a premium selection, a quote, trending destinations, and the
 * philosophy.
 *
 * Two departures from the mockup, both for the same reason. The premium
 * and featured carousels are grids: a carousel hides two thirds of what
 * it holds behind a control, which on the page that has to make a first
 * impression is the wrong trade. And the settings mosaic reads real
 * settings from the database rather than six hardcoded ones, so it
 * cannot drift from the filter on /venues the way the old site did.
 */

const PATHS = [
  { title: 'Retreat venues', image: '/images/path-retreat-venues.jpg',
    text: 'Curated spaces for immersive retreat experiences.',
    href: '/venues?marketplace=Retreat' },
  { title: 'Wellness venues', image: '/images/path-wellness-venues.jpg',
    text: 'Day spas, bathhouses and thermal sanctuaries for restoration.',
    href: '/venues?marketplace=Wellness' },
  { title: 'Wellness experiences', image: '/images/path-experiences.jpg',
    text: 'Find a venue by the practice you are looking for.',
    href: '/wellness-experiences' },
];

const SETTING_IMAGES: Record<string, string> = {
  coastal: '/images/setting-coastal.jpg',
  beachfront: '/images/setting-coastal.jpg',
  desert: '/images/setting-desert.jpg',
  tropical: '/images/setting-tropical.jpg',
  urban: '/images/setting-urban.jpg',
  forest: '/images/philosophy-forest.jpg',
  rainforest: '/images/philosophy-forest.jpg',
  mountain: '/images/philosophy-meditation.jpg',
};

const FEATURES = [
  ['Filter by what happens there',
   'Not just where a venue is, but which practices it actually holds — and whether the space suits them.'],
  ['Capacity that means something',
   'How many the shala seats, not how many the building sleeps. The two are rarely the same.'],
  ['Access, stated plainly',
   'Step-free routes, accessible bathrooms, and who a venue is open to. Asked before you enquire, not after.'],
  ['Setting, not postcode',
   'Beachfront and twenty minutes from a beach are different things, and we record which is which.'],
];

const PRINCIPLES = [
  ['Curated with intention',
   'Every venue is read by a person. The collection is smaller than it could be, on purpose.'],
  ['Transparency first',
   'Accurate information about what a venue genuinely offers. No inflated claims.'],
  ['Connection and community',
   'Venue owners, retreat hosts and guests in one ecosystem that serves all three.'],
  ['Global by design',
   'Scandinavia to South America, Southeast Asia to the Pacific.'],
];

function VenueTile({ v }: { v: Card }) {
  return (
    <Link href={venueHref(v)} className="premium-card">
      <div className="premium-card-image">
        {v.image_url
          ? <img src={v.image_url} alt="" loading="lazy" />
          : <span className="placeholder-img">The Global Sanctum</span>}
        {v.venue_type && <span className="premium-card-tag">{v.venue_type}</span>}
      </div>
      <div className="premium-card-content">
        <p className="premium-card-location">{placeOf(v)}</p>
        <h3 className="premium-card-name">{v.headline ?? v.venue_name}</h3>
        <p className="premium-card-desc">
          {v.editor_note ?? v.listing_description ?? v.venue_short_description}
        </p>
        <p className="premium-card-type">
          {[v.max_guests && `Sleeps ${v.max_guests}`,
            v.rating ? `★ ${Number(v.rating).toFixed(1)}` : null]
            .filter(Boolean).join('  ·  ')}
        </p>
        <span className="premium-card-cta">See the venue &rarr;</span>
      </div>
    </Link>
  );
}

export default async function Home() {
  const supabase = await createClient();

  const [{ data: cards }, { data: settings }, { data: countries }] = await Promise.all([
    supabase.from('venue_cards').select('*')
      .order('tier_order').order('rating', { ascending: false, nullsFirst: false }),
    supabase.from('filter_counts').select('*').eq('kind', 'setting')
      .gt('venues', 0).order('venues', { ascending: false }).limit(6),
    supabase.from('venue_cards').select('country, country_slug').not('country', 'is', null),
  ]);

  const venues = (cards ?? []) as Card[];
  const premium = venues.filter((v) => v.tier_order <= 2).slice(0, 3);
  const rest = venues.filter((v) => !premium.includes(v)).slice(0, 6);

  // Countries with the most venues, for the trending grid.
  const byCountry = new Map<string, { name: string; slug: string; n: number }>();
  for (const c of (countries ?? []) as any[]) {
    const e = byCountry.get(c.country_slug);
    if (e) e.n += 1;
    else byCountry.set(c.country_slug, { name: c.country, slug: c.country_slug, n: 1 });
  }
  const trending = [...byCountry.values()].sort((a, b) => b.n - a.n).slice(0, 4);
  const trendingImages = ['/images/destination-australia.jpg', '/images/destination-japan.jpg',
                          '/images/destination-india.jpg', '/images/destination-thailand.jpg'];

  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg">
          <img src="/images/setting-coastal.jpg" alt="" />
        </div>
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">The Global Sanctum</div>
          <h1 className="hero-headline">
            Thoughtfully curated.<br />Globally connected.
          </h1>
          <p className="hero-subtext">
            Discover exceptional retreat venues and wellness sanctuaries around
            the world.
          </p>

          <HomeSearch />

          <div className="hero-ctas">
            <Link className="hero-cta-link" href="/venues?marketplace=Retreat">
              Browse retreat venues &rarr;
            </Link>
            <Link className="hero-cta-link" href="/venues?marketplace=Wellness">
              Explore wellness venues &rarr;
            </Link>
            <Link className="hero-cta-link" href="/wellness-experiences">
              Discover experiences &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── intro ────────────────────────────────────────────────── */}
      <section className="intro">
        <div className="intro-inner">
          <div className="intro-content">
            <div className="intro-eyebrow">A new era of wellness discovery</div>
            <h2 className="intro-title">
              The spaces where wellness happens. The venues where retreats
              come to life.
            </h2>
            <p className="intro-text">
              We are the first curated platform dedicated to transformative wellness
              venues and retreat spaces.
            </p>
            <p className="intro-text">
              Whether you are a retreat host seeking the right venue, a wellness guest
              designing your next experience, or simply seeking restoration, we connect
              you with extraordinary spaces around the world.
            </p>
            <Link className="intro-link" href="/about">
              About The Global Sanctum &rarr;
            </Link>
          </div>
          <div className="intro-image">
            <img src="/images/intro-sauna.jpg" alt="" />
            <div className="intro-image-accent" />
          </div>
        </div>
      </section>

      {/* ── settings mosaic ──────────────────────────────────────── */}
      {!!settings?.length && (
        <section className="explore">
          <div className="explore-header">
            <div className="intro-eyebrow">Discover differently</div>
            <h2 className="intro-title">Explore intentional spaces around the world</h2>
            <p className="intro-text">
              From coastal sanctuaries to mountain retreats where silence does the
              work. Spaces where wellness lives in the foundations.
            </p>
          </div>
          <div className="explore-mosaic">
            {(settings as any[]).map((s) => (
              <Link key={s.slug} href={`/venues?setting=${s.slug}`} className="mosaic-tile">
                <img src={SETTING_IMAGES[s.slug] ?? '/images/setting-tropical.jpg'}
                  alt="" loading="lazy" />
                <div className="mosaic-overlay" />
                <div className="mosaic-label">
                  {s.name}
                  <span>{s.venues} {s.venues === 1 ? 'venue' : 'venues'}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── three paths ──────────────────────────────────────────── */}
      <section className="paths">
        <div className="paths-inner">
          <div className="paths-header">
            <div className="intro-eyebrow">Find your path</div>
            <h2 className="intro-title">Three ways to discover</h2>
          </div>
          <div className="paths-grid">
            {PATHS.map((p) => (
              <Link key={p.title} href={p.href} className="path-card">
                <div className="path-card-bg"><img src={p.image} alt="" loading="lazy" /></div>
                <div className="path-card-overlay" />
                <div className="path-card-content">
                  <h3 className="path-card-title">{p.title}</h3>
                  <p className="path-card-text">{p.text}</p>
                  <span className="path-card-cta">Explore &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── the selection ────────────────────────────────────────── */}
      {!!premium.length && (
        <section className="premium">
          <div className="premium-inner">
            <div className="premium-header">
              <div>
                <div className="intro-eyebrow">The selection</div>
                <h2 className="intro-title">Venues we would send our own people to</h2>
                <p className="premium-subtitle">
                  A handful from the collection, chosen rather than ranked.
                </p>
              </div>
              <Link className="premium-link" href="/venues">See all venues &rarr;</Link>
            </div>
            <div className="premium-slide">
              {premium.map((v) => <VenueTile key={v.id} v={v} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── quote ────────────────────────────────────────────────── */}
      <section className="quote-section">
        <p className="quote-text">
          The spaces where wellness happens deserve the same care as the work
          that happens in them.<span className="quote-close">&rdquo;</span>
        </p>
        <div className="quote-author">The Global Sanctum</div>
      </section>

      {/* ── trending destinations ────────────────────────────────── */}
      {!!trending.length && (
        <section className="trending">
          <div className="trending-inner">
            <div className="trending-header">
              <div className="intro-eyebrow">Where people are going</div>
              <h2 className="intro-title">Destinations in the collection</h2>
            </div>
            <div className="trending-grid">
              {trending.map((t, i) => (
                <Link key={t.slug} href={`/venues?country=${t.slug}`}
                  className={`trending-item ${i === 0 ? 'trending-item-large' : ''}`}>
                  <img src={trendingImages[i] ?? trendingImages[0]} alt="" loading="lazy" />
                  <div className="trending-item-overlay" />
                  <div className="trending-item-content">
                    <div className="trending-item-name">{t.name}</div>
                    <div className="trending-item-tagline">
                      {t.n} {t.n === 1 ? 'venue' : 'venues'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── more of the collection ───────────────────────────────── */}
      {!!rest.length && (
        <section className="featured">
          <div className="featured-inner">
            <div className="featured-header">
              <div>
                <div className="intro-eyebrow">More of the collection</div>
                <h2 className="intro-title">Recently added</h2>
              </div>
              <Link className="featured-link" href="/venues">See all venues &rarr;</Link>
            </div>
            <div className="featured-slide">
              {rest.slice(0, 3).map((v) => <VenueTile key={v.id} v={v} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── what the search does ─────────────────────────────────── */}
      <section className="search-features">
        <div className="search-features-inner">
          <div className="search-features-image">
            <img src="/images/experience-thermal.jpg" alt="" loading="lazy" />
          </div>
          <div>
            <div className="intro-eyebrow">Search that knows the difference</div>
            <h2 className="intro-title">Built for how people actually look</h2>
            <div className="search-features-list">
              {FEATURES.map(([title, text]) => (
                <div key={title}>
                  <div className="search-feature-title">{title}</div>
                  <p className="search-feature-text">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── philosophy ───────────────────────────────────────────── */}
      <section className="philosophy">
        <div className="philosophy-inner">
          <div>
            <div className="intro-eyebrow">What guides us</div>
            <h2 className="intro-title">Curated for depth, not volume</h2>
            <div className="philosophy-principles">
              {PRINCIPLES.map(([title, text]) => (
                <div key={title}>
                  <div className="search-feature-title">{title}</div>
                  <p className="search-feature-text">{text}</p>
                </div>
              ))}
            </div>
            <Link className="intro-link" href="/about">Read our story &rarr;</Link>
          </div>
          <div className="philosophy-images">
            <img src="/images/philosophy-meditation.jpg" alt="" loading="lazy" />
            <img src="/images/philosophy-yoga.jpg" alt="" loading="lazy" />
            <img src="/images/philosophy-forest.jpg" alt="" loading="lazy" />
            <img src="/images/experience-forest.jpg" alt="" loading="lazy" />
          </div>
        </div>
      </section>
    </>
  );
}
