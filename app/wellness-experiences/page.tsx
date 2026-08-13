import type { Metadata } from 'next';
import { categories } from '@/lib/experiences';
import { createClient } from '@/lib/supabase/server';
import ExperienceGrid from '@/components/ExperienceGrid';

export const metadata: Metadata = {
  title: 'Wellness Experiences — The Global Sanctum',
  description:
    'Browse transformative modalities and healing practices. Each links directly to the venues that offer them.',
};

// Fallback hero images for the three categories without an image in the database yet.
// Free to use under the Unsplash License. Replace with local /experiences/*.jpg once uploaded.
const FALLBACK_IMG: Record<string, string> = {
  'nature-adventure-wellness':
    'https://images.unsplash.com/photo-1768992363350-b1f5b6176239?w=900&q=75&auto=format&fit=crop',
  'skin-aesthetic-wellness':
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=75&auto=format&fit=crop',
  'fitness-and-conditioning':
    'https://images.unsplash.com/photo-1747240549807-fc3962949818?w=900&q=75&auto=format&fit=crop',
};

// Placeholder taglines used until the tagline field is filled in the database.
const FALLBACK_TAG: Record<string, string> = {
  'thermal-hydrotherapy': 'Hot springs, bathhouses and the healing power of water.',
  'yoga-movement': 'Every tradition of yoga, breath and conscious movement.',
  breathwork: 'From gentle pranayama to holotropic journeys.',
  'sound-vibrational': 'Sound baths, gong and vibrational healing.',
  ayurveda: 'The ancient Indian science of balance and cleansing.',
  'indigenous-earth-traditions': 'Earth-based ceremony and lineage healing.',
  'plant-medicine-ceremony': 'Sacred plant ceremony, held with care and protocol.',
  'meditation-mindfulness': 'Silent sits, guided practice and the trained attention.',
  'body-therapies-bodywork': 'Massage, myofascial release and hands-on healing.',
  'nutrition-cleansing': 'Fasting, detox and nourishment-led programmes.',
  'nature-adventure-wellness': 'Forest bathing, cold water and wellbeing in the wild.',
  'energy-esoteric': 'Reiki, energy healing and the subtle arts.',
  'modern-wellness': 'Cryotherapy, infrared and longevity science.',
  'skin-aesthetic-wellness': 'Facials, skin health and considered aesthetics.',
  'fitness-and-conditioning': 'Strength, mobility and performance training.',
};

export default async function ExperiencesPage() {
  const supabase = await createClient();
  const [cats, { data: allPractices }] = await Promise.all([
    categories(),
    supabase
      .from('experience_practices')
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

  const withPractices = (cats as any[])
    .filter((c) => c.in_wellness)
    .map((c) => ({
      name: c.name as string,
      slug: c.slug as string,
      image: (c.hero_image_url ?? FALLBACK_IMG[c.slug] ?? null) as string | null,
      tagline: (c.tagline ?? FALLBACK_TAG[c.slug] ?? '') as string,
      practices: byCategory.get(c.slug) ?? [],
    }));

  const wellnessSlugs = new Set(withPractices.map((c) => c.slug));
  const wellnessPractices = ((allPractices ?? []) as any[]).filter((p) =>
    wellnessSlugs.has(p.category_slug),
  );
  const practiceCount = wellnessPractices.length;
  const spaceCount = wellnessPractices.reduce((a, p) => a + (p.venue_count ?? 0), 0);

  return (
    <div className="wx-page">
      <header className="wx-head">
        <div className="wx-head-eyebrow">Modalities &amp; Practices</div>
        <div className="wx-head-grid">
          <div>
            <h1>
              Explore by <em>experience</em>
            </h1>
            <div className="wx-head-sub">Choose a modality to see the practices within it.</div>
          </div>
          <div>
            <p className="wx-head-body">
              Begin with a modality that calls to you. Each opens to the practices it holds, and every
              practice leads to the venues where you can experience it.
            </p>
            <div className="wx-head-count">
              {withPractices.length} categories&nbsp;&middot;&nbsp;{practiceCount} practices&nbsp;&middot;&nbsp;
              {spaceCount} spaces
            </div>
          </div>
        </div>
      </header>

      <ExperienceGrid categories={withPractices} />

      <section className="wx-info">
        <div>
          <div className="wx-info-eyebrow">How it works</div>
          <h2>Browse by practice, arrive at a place.</h2>
          <p>
            Each practice links directly to the venues offering that modality. Nothing is duplicated, so
            the experience lives at the venue.
          </p>
        </div>
        <div>
          <div className="wx-info-eyebrow">Can&rsquo;t find your practice?</div>
          <h2>The collection is always growing.</h2>
          <p>
            If a modality you&rsquo;re seeking isn&rsquo;t here yet, tell our concierge and we&rsquo;ll help
            you find the right space for it.
          </p>
        </div>
      </section>
    </div>
  );
}
