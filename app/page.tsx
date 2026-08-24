import type { Metadata } from 'next';
import Link from 'next/link';
import Carousel from '@/components/Carousel';
import HomeSearch from '@/components/HomeSearch';
import { placeOf, venueHref, type Card } from '@/lib/venues';
import { articles, heroUrl } from '@/lib/sanity';
import { createClient } from '@/lib/supabase/server';
import { categories } from '@/lib/experiences';
import HomeExperiences from '@/components/HomeExperiences';

function fmtDate(iso: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-AU',
      { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Global Sanctum — Curated Wellness Retreats & Sanctuaries Worldwide',
  description:
    'Discover the world\'s most exceptional wellness venues, retreat spaces and wellness experiences, thoughtfully curated.',
  alternates: { canonical: '/' },
};

/* The home page, from tgs_home_v6.
 *
 * The copy is the mockup's, word for word. Where a venue or a count is
 * shown it comes from the database, so the page cannot claim a venue it
 * does not have — but nothing that was written has been rewritten.
 */

const PATHS = [
  { title: 'Retreat Venues', text: 'Curated spaces for immersive retreat experiences.',
    cta: 'Explore Venues', href: '/venues?marketplace=Retreat',
    image: '/images/path-retreat-venues.jpg' },
  { title: 'Wellness Venues', text: 'Sanctuaries where restoration becomes routine.',
    cta: 'Explore Venues', href: '/venues?marketplace=Wellness',
    image: '/images/path-wellness-venues.jpg' },
  { title: 'Wellness Experiences', text: 'Single sessions and ancient healing traditions.',
    cta: 'Explore Experiences', href: '/wellness-experiences',
    image: '/images/path-experiences.jpg' },
];

const WX_FALLBACK_IMG: Record<string, string> = {
  'nature-adventure-wellness': 'https://images.unsplash.com/photo-1768992363350-b1f5b6176239?w=900&q=75&auto=format&fit=crop',
  'skin-aesthetic-wellness': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=75&auto=format&fit=crop',
  'fitness-and-conditioning': 'https://images.unsplash.com/photo-1747240549807-fc3962949818?w=900&q=75&auto=format&fit=crop',
};

const SETTINGS = [
  ['Coastal Sanctuaries', 'coastal', '/images/setting-coastal.jpg', 'Wellness by the sea, where the horizon does the calming'],
  ['Forest Hideaways', 'forest', '/images/philosophy-forest.jpg', 'Deep in the canopy, far from everything'],
  ['Desert Retreats', 'desert', '/images/setting-desert.jpg', 'Stillness and clarity under vast open skies'],
  ['Tropical Sanctuaries', 'tropical', '/images/setting-tropical.jpg', 'Warmth, greenery and the unhurried pace of the tropics'],
  ['Urban Sanctuaries', 'urban', '/images/setting-urban.jpg', 'A pocket of calm in the heart of the city'],
  ['Mountain Sanctuaries', 'mountain', '/images/philosophy-meditation.jpg', 'Clear air, long views and quiet at altitude'],
];

const DESTINATIONS = [
  ['Australia', 'Vast landscapes, ancient wellness', 'australia',
   '/images/destination-australia.jpg'],
  ['Bali', 'Sacred island, spiritual sanctuary', 'indonesia',
   '/images/destination-thailand.jpg'],
  ['Japan', 'Ancient traditions, thermal waters', 'japan',
   '/images/destination-japan.jpg'],
  ['India', 'Ayurvedic wisdom, sacred rituals', 'india',
   '/images/destination-india.jpg'],
  ['Thailand', 'Tropical healing, mindful traditions', 'thailand',
   '/images/setting-tropical.jpg'],
];

const SEARCH_BY = [
  ['By Modality',
   'Yoga, breathwork, plant medicine, somatic work, sound healing, permaculture and more.'],
  ['By Location',
   'Coastal sanctuaries, mountain temples, thermal springs, tropical hideaways.'],
  ['By Wellness Type',
   'Ayurvedic, traditional Chinese medicine, thermal hydrotherapy, cryotherapy.'],
  ['By Architecture',
   'Eco lodges, heritage properties, purpose-built centres, minimalist sanctuaries.'],
];

const PRINCIPLES = [
  ['Accessibility Without Pretence',
   'Every venue, every host, every wellness guest — elevated, never exclusionary'],
  ['Reverence For The Craft',
   'Ancient traditions, modern practitioners, and the sacred lands they hold — honoured'],
  ['Effortless By Design',
   'Discovery for guests, bookings for venues, tools for hosts — technology working quietly'],
  ['A Higher Standard, Together',
   'Better data, deeper insight, and a bar we raise across the industry as one'],
];

function VenueSlide({ v }: { v: Card }) {
  return (
    <Link href={venueHref(v)} className="premium-card">
      <div className="premium-card-image">
        {v.image_url
          ? <img src={v.image_url} alt="" loading="lazy" />
          : <span className="placeholder-img">The Global Sanctum</span>}
        {v.country && <span className="premium-card-tag">{v.country}</span>}
      </div>
      <div className="premium-card-content">
        <p className="premium-card-location">{placeOf(v)}</p>
        <h3 className="premium-card-name">{v.headline ?? v.venue_name}</h3>
        <p className="premium-card-desc">
          {v.editor_note ?? v.listing_description ?? v.venue_short_description}
        </p>
        <p className="premium-card-type">{v.venue_type}</p>
        <span className="premium-card-cta">Explore Venue &rarr;</span>
      </div>
    </Link>
  );
}

/* The featured section uses the smaller venue-card from the mockup, not
 * the large premium card: image with a country tag, place, name and a
 * quiet CTA — no description or type. Premium is the showcase; featured
 * is the browse. */
function FeaturedSlide({ v }: { v: Card }) {
  return (
    <Link href={venueHref(v)} className="venue-card">
      <div className="venue-card-image">
        {v.image_url
          ? <img src={v.image_url} alt="" loading="lazy" />
          : <span className="placeholder-img">The Global Sanctum</span>}
        {v.country && <span className="venue-card-tag">{v.country}</span>}
      </div>
      <div className="venue-card-content">
        <p className="venue-card-location">{placeOf(v)}</p>
        <h3 className="venue-card-name">{v.headline ?? v.venue_name}</h3>
        <span className="card-cta">Explore Venue &rarr;</span>
      </div>
    </Link>
  );
}

const CONCIERGE = [
  {
    title: 'Planning a retreat?',
    line: "Share your vision and we\u2019ll match you to venues, dates and the support to pull it together.",
    role: 'Retreat Host',
    cta: 'Start a retreat enquiry',
    chips: [
      "I\u2019m hosting a leadership retreat",
      "I need a venue with a shala for 20",
      "I\u2019m looking for a facilitator-friendly space",
      "My group needs complete privacy",
    ],
  },
  {
    title: 'Seeking wellness?',
    line: "Tell us what you need and we\u2019ll point you to the right sanctuary or experience.",
    role: 'Wellness Guest',
    cta: 'Start a wellness enquiry',
    chips: [
      "I want a luxury wellness weekend",
      "I\u2019m looking for thermal springs",
      "I need a solo restorative escape",
      "I want sound healing and breathwork",
    ],
  },
];

export default async function Home() {
  const supabase = await createClient();

  const { data } = await supabase.from('venue_cards').select('*')
    .order('tier_order').order('rating', { ascending: false, nullsFirst: false });

  // Every setting, straight from the database, so the hero search always
  // offers the full list rather than a hard-coded subset.
  const { data: settingsData } = await supabase.from('venue_settings')
    .select('name,slug').order('display_order');
  const settings = settingsData ?? [];

  // Latest Wellness Edit pieces from Sanity for the home editorial section.
  // A few extra are fetched so obvious test pieces can be filtered out.
  const posts = ((await articles(6)) ?? [])
    .filter((a) => !/test/i.test(a.title ?? ''))
    .slice(0, 4);

  // Wellness experience categories (+ their practices) for the home rail.
  const [catList, { data: allPractices }] = await Promise.all([
    categories(),
    supabase.from('experience_practices').select('name,slug,category_slug,venue_count')
      .order('display_order', { nullsFirst: false }).order('name'),
  ]);
  const byCat = new Map<string, any[]>();
  for (const p of (allPractices ?? []) as any[]) {
    const list = byCat.get(p.category_slug) ?? []; list.push(p); byCat.set(p.category_slug, list);
  }
  const wxCategories = (catList as any[]).filter((c) => c.in_wellness).map((c) => ({
    name: c.name as string, slug: c.slug as string,
    image: (c.hero_image_url ?? WX_FALLBACK_IMG[c.slug] ?? null) as string | null,
    tagline: (c.tagline ?? '') as string,
    practices: byCat.get(c.slug) ?? [],
  }));

  const venues = (data ?? []) as Card[];
  const premium = venues.filter((v) => v.tier_order <= 2);
  const featured = venues.filter((v) => v.tier_order > 2);

  return (
    <>
      <section className="hero hero-home">
        <div className="hero-bg"><img src="/images/hero-home.jpg" alt="" /></div>
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-headline">
            The world&rsquo;s sanctuary for wellness and retreats,<br /><em>thoughtfully curated.</em>
          </h1>
          <p className="hero-subtext">
            Whether you&rsquo;re planning a retreat or seeking your own restoration, discover exceptional wellness venues, retreat spaces and experiences the world over.
          </p>

          <HomeSearch settings={settings} />

          <div className="hero-ctas">
            <Link className="hero-cta-link" href="/venues?marketplace=Retreat">
              Browse Retreat Venues &rarr;
            </Link>
            <Link className="hero-cta-link" href="/venues?marketplace=Wellness">
              Explore Wellness Venues &rarr;
            </Link>
            <Link className="hero-cta-link" href="/wellness-experiences">
              Discover Wellness Experiences &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="intro">
        <div className="intro-inner">
          <div className="intro-content">
            <div className="intro-eyebrow">A New Era of Wellness Discovery</div>
            <h2 className="intro-title">
              The spaces where wellness happens. The venues where retreats come to
              life. <em>Curated and connected worldwide.</em>
            </h2>
            <p className="intro-text">
              We are the world&rsquo;s first curated platform dedicated exclusively to
              transformative wellness venues and retreat spaces.
            </p>
            <p className="intro-text">
              Whether you&rsquo;re a retreat host seeking the perfect venue, a wellness
              guest designing your next experience, or simply seeking restoration, The
              Global Sanctum connects you with extraordinary spaces around the world.
            </p>
            <Link className="intro-link" href="/about">
              About The Global Sanctum &rarr;
            </Link>
          </div>
          <div className="intro-image">
            <img src="/images/intro-sauna.jpg" alt="A modern sauna interior" />
            <div className="intro-image-accent" />
          </div>
        </div>
      </section>

      <section className="paths">
        <div className="paths-inner">
          <div className="paths-header">
            <div className="intro-eyebrow">Find Your Path</div>
            <h2 className="intro-title">Three Ways to <em>Discover</em></h2>
            <p className="intro-text">
              From thermal springs to forest sanctuaries, coastal retreats to mountain
              hideaways. Spaces where restoration isn&rsquo;t an afterthought &mdash;
              it&rsquo;s the foundation.
            </p>
          </div>
          <div className="paths-grid">
            {PATHS.map((p) => (
              <Link key={p.title} href={p.href} className="path-card">
                <div className="path-card-bg"><img src={p.image} alt="" loading="lazy" /></div>
                <div className="path-card-overlay" />
                <div className="path-card-content">
                  <h3 className="path-card-title">{p.title}</h3>
                  <p className="path-card-text">{p.text}</p>
                  <span className="path-card-cta">{p.cta} &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="explore">
        <div className="explore-header-row">
          <div className="explore-header-text">
            <div className="intro-eyebrow">Discover Differently</div>
            <h2 className="intro-title">Immerse Yourself in <em>Extraordinary Settings</em></h2>
            <p className="intro-text">
              From tranquil coastlines to urban escapes, experience retreats and wellness in the
              world&rsquo;s most extraordinary settings, where the place itself becomes part of the
              restoration.
            </p>
          </div>
          <Link href="/settings" className="explore-more-btn">Explore More Settings <span>&rarr;</span></Link>
        </div>
        <div className="explore-carousel-wrap">
          <Carousel label="extraordinary settings">
            {SETTINGS.map(([name, slug, image, tagline]) => (
              <Link key={slug} href={`/settings/${slug}`} className="mosaic-tile">
                <img src={image} alt="" loading="lazy" />
                <div className="mosaic-overlay" />
                <div className="mosaic-content">
                  <h3 className="mosaic-name">{name}</h3>
                  <p className="mosaic-tag">{tagline}</p>
                  <span className="mosaic-cta">Explore <span className="mosaic-ar">&rarr;</span></span>
                </div>
              </Link>
            ))}
          </Carousel>
        </div>
      </section>

      <section className="hx-section">
        <div className="hx-header-c">
          <div className="intro-eyebrow">Wellness Experiences</div>
          <h2 className="intro-title">Wellness, <em>One Experience at a Time</em></h2>
          <p className="intro-text">
            Not every journey is a multi-day retreat. A wellness experience is the single session
            or practice itself: a thermal bathing ritual, an hour of sound healing, an Ayurvedic
            treatment, a morning of yoga. Restorative moments to seek out anywhere in the world,
            on their own terms.
          </p>
        </div>
        <HomeExperiences categories={wxCategories} />
        <div className="hx-all-wrap">
          <Link href="/wellness-experiences" className="hx-all">Explore all wellness experiences <span>&rarr;</span></Link>
        </div>
      </section>

      {!!premium.length && (
        <section className="premium">
          <div className="premium-inner">
            <div className="premium-header">
              <div>
                <div className="intro-eyebrow">Intentionally Curated</div>
                <h2 className="intro-title">Our <em>Premium</em> Collection</h2>
                <p className="premium-subtitle">
                  The most exceptional wellness and retreat venues, offering
                  unparalleled experiences in extraordinary settings.
                </p>
              </div>
              <Link className="premium-link" href="/venues">
                Explore Premium Venues &rarr;
              </Link>
            </div>
            <Carousel label="premium venues">
              {premium.map((v) => <VenueSlide key={v.id} v={v} />)}
            </Carousel>
          </div>
        </section>
      )}

      <section className="trending">
        <div className="trending-inner">
          <div className="trending-header">
            <div className="intro-eyebrow">Where Seekers Are Drawn</div>
            <h2 className="intro-title">Destinations Defining <em>Wellness Travel</em></h2>
            <p className="intro-text">
              The places calling to those seeking transformation, restoration, and
              spaces that hold intention in their foundations.
            </p>
          </div>
          <div className="trending-grid">
            {DESTINATIONS.map(([name, tagline, slug, image], i) => (
              <Link key={name} href={`/venues?country=${slug}`}
                className={`trending-item ${i === 0 ? 'trending-item-large' : ''}`}>
                <img src={image} alt="" loading="lazy" />
                <div className="trending-item-overlay" />
                <div className="trending-item-content">
                  <div className="trending-item-name">{name}</div>
                  <div className="trending-item-tagline">{tagline}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {!!featured.length && (
        <section className="featured">
          <div className="featured-inner">
            <div className="featured-header">
              <div>
                <div className="intro-eyebrow">Featured Sanctuaries</div>
                <h2 className="intro-title">Our Collection of <em>Featured</em> Venues</h2>
                <p className="featured-subtitle">
                  From Japanese onsen to Greek island retreats. Mountain sanctuaries to
                  coastal hideaways. Spaces where the environment does half the healing.
                </p>
              </div>
              <Link className="featured-link" href="/venues">
                Explore All Venues &rarr;
              </Link>
            </div>
            <Carousel label="featured venues">
              {featured.map((v) => <FeaturedSlide key={v.id} v={v} />)}
            </Carousel>
          </div>
        </section>
      )}

      <section className="search-features">
        <div className="search-features-inner">
          <div className="search-features-image">
            <img src="/images/experience-thermal.jpg" alt="" loading="lazy" />
          </div>
          <div>
            <div className="intro-eyebrow">Discover Intentionally</div>
            <h2 className="intro-title">Search Beyond The <em>Surface</em></h2>
            <p className="intro-text">
              Search for what truly matters &mdash; the practices supported, the
              experiences felt, the spaces designed, the environments created &mdash;
              not just where and when.
            </p>
            <div className="search-features-list">
              {SEARCH_BY.map(([title, text]) => (
                <div key={title}>
                  <div className="search-feature-title">{title}</div>
                  <p className="search-feature-text">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="concierge">
        <div className="concierge-inner">
          <div className="concierge-head">
            <img className="concierge-logo" src="/brand/sanctum-concierge-logo.svg"
              alt="Sanctum Concierge" width={300} height={87} />
            <h2 className="concierge-title">Tell us what you have in mind.</h2>
            <p className="concierge-lead">
              Whether you&rsquo;re hosting or simply seeking, our concierge helps you find
              the right place, the right practice and the right people.
            </p>
          </div>

          <div className="concierge-tracks">
            {CONCIERGE.map((t) => (
              <div key={t.role} className="concierge-track">
                <h3 className="concierge-track-title">{t.title}</h3>
                <p className="concierge-track-line">{t.line}</p>
                <div className="concierge-chips">
                  {t.chips.map((chip) => (
                    <Link key={chip}
                      href={`/contact?role=${encodeURIComponent(t.role)}&intent=${encodeURIComponent(chip)}`}>
                      {chip}
                    </Link>
                  ))}
                </div>
                <Link className="concierge-cta"
                  href={`/contact?role=${encodeURIComponent(t.role)}`}>
                  {t.cta} &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="home-edit">
          <div className="home-edit-inner">
            <div className="paths-header">
              <div className="intro-eyebrow">Stories &amp; Wisdom</div>
              <h2 className="intro-title">The <em>Wellness Edit</em></h2>
              <p className="intro-text">
                Guides, reflections and inspiration for the path &mdash; from our editors
                and the practitioners who live it.
              </p>
            </div>

            <Link href={`/the-wellness-edit/${posts[0].slug}`} className="edit-lead">
              {heroUrl(posts[0], 1400, 900) && (
                <div className="edit-lead-image">
                  <img src={heroUrl(posts[0], 1400, 900)!}
                    alt={posts[0].heroImage?.alt ?? ''} />
                </div>
              )}
              <div className="edit-lead-body">
                {posts[0].category && <div className="edit-card-cat">{posts[0].category}</div>}
                <h3 className="edit-lead-title">{posts[0].title}</h3>
                {posts[0].excerpt && <p className="edit-lead-excerpt">{posts[0].excerpt}</p>}
                <div className="edit-meta">
                  {fmtDate(posts[0].publishedAt) && <span>{fmtDate(posts[0].publishedAt)}</span>}
                </div>
                <span className="edit-lead-cta">Read the article &rarr;</span>
              </div>
            </Link>

            {posts.length > 1 && (
              <div className="edit-grid">
                {posts.slice(1, 4).map((a) => (
                  <Link key={a.slug} href={`/the-wellness-edit/${a.slug}`} className="edit-card">
                    {heroUrl(a, 720, 480) && (
                      <div className="edit-card-image">
                        <img src={heroUrl(a, 720, 480)!}
                          alt={a.heroImage?.alt ?? ''} loading="lazy" />
                      </div>
                    )}
                    <div className="edit-card-body">
                      {a.category && <div className="edit-card-cat">{a.category}</div>}
                      <h3 className="edit-card-title">{a.title}</h3>
                      {a.excerpt && <p className="edit-card-excerpt">{a.excerpt}</p>}
                      <div className="edit-meta">
                        {fmtDate(a.publishedAt) && <span>{fmtDate(a.publishedAt)}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="home-edit-foot">
              <Link className="intro-link" href="/the-wellness-edit">
                Explore The Wellness Edit &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
