/* The Wellness Edit, from Sanity.
 *
 * No SDK. Sanity's query endpoint is a GET with a GROQ string, and the
 * image URL is a documented transformation of an asset reference — both
 * are a few lines, and a dependency for either would be more code than
 * it saves.
 *
 * The dataset is public, so no token. That is deliberate on Sanity's
 * side for published content, and it means nothing secret lives here.
 */

const PROJECT = '3kjpidry';
const DATASET = 'production';
const API = '2021-06-07';

// apicdn is the cached edge. Slightly stale is the right trade for
// editorial — an article published a minute ago appearing a minute later
// costs nobody anything.
const ENDPOINT = `https://${PROJECT}.apicdn.sanity.io/v${API}/data/query/${DATASET}`;

export type PortableBlock = {
  _type: string;
  _key?: string;
  style?: string;
  listItem?: string;
  level?: number;
  children?: { _key?: string; text?: string; marks?: string[] }[];
  markDefs?: { _key: string; _type: string; href?: string }[];
  asset?: { _ref?: string };
  alt?: string;
};

export type Article = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: PortableBlock[] | null;
  heroImage: { asset?: { _ref?: string }; alt?: string } | null;
  author: string | null;
  publishedAt: string | null;
  _updatedAt: string | null;
  category: string | null;
  tags: string[] | null;
  seoTitle: string | null;
  seoDescription: string | null;
  layout: string | null;
};

async function query<T>(groq: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(groq)}`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.result ?? null) as T;
  } catch {
    // The Wellness Edit being unreachable should cost the reader an
    // empty section, not a broken page. Every caller handles null.
    return null;
  }
}

/* Test posts, which the handover says are in the dataset and should be
 * deleted. Filtered here as well, because the audit lists test content
 * on the live site as a current fault and a filter costs nothing —
 * whereas noticing it after launch costs an apology. */
const NOT_A_TEST =
  `!(title match "*test*") && !(title match "*testing*")`;

const FIELDS = `
  _id, title, "slug": slug.current, excerpt, author, publishedAt, _updatedAt,
  category, tags, seoTitle, seoDescription, layout, heroImage
`;

export async function articles(limit = 24) {
  return (await query<Article[]>(
    `*[_type == "article" && defined(slug.current) && defined(publishedAt)
       && ${NOT_A_TEST}]
     | order(publishedAt desc)[0...${limit}]{${FIELDS}, body}`
  )) ?? [];
}

export async function article(slug: string) {
  return await query<Article>(
    `*[_type == "article" && slug.current == $slug][0]{${FIELDS}, body}`
      .replace('$slug', JSON.stringify(slug))
  );
}

/** Other pieces, for the foot of an article. Same category first, since
 *  somebody who read about biophilic design wants the next one like it. */
export async function moreArticles(slug: string, category: string | null, n = 3) {
  const not = JSON.stringify(slug);
  const cat = category ? JSON.stringify(category) : null;

  const same = cat
    ? (await query<Article[]>(
        `*[_type == "article" && slug.current != ${not} && category == ${cat}
           && defined(publishedAt) && ${NOT_A_TEST}]
         | order(publishedAt desc)[0...${n}]{${FIELDS}}`)) ?? []
    : [];

  if (same.length >= n) return same;

  const rest = (await query<Article[]>(
    `*[_type == "article" && slug.current != ${not}
       && defined(publishedAt) && ${NOT_A_TEST}]
     | order(publishedAt desc)[0...${n + 3}]{${FIELDS}}`)) ?? [];

  const seen = new Set(same.map((a) => a.slug));
  return [...same, ...rest.filter((a) => !seen.has(a.slug))].slice(0, n);
}

export async function authors() {
  const list = (await query<string[]>(
    `array::unique(*[_type == "article" && defined(publishedAt)
       && ${NOT_A_TEST}].author)`
  )) ?? [];
  return list.filter(Boolean).sort();
}

export async function categories() {
  const list = (await query<string[]>(
    `array::unique(*[_type == "article" && defined(publishedAt)
       && ${NOT_A_TEST}].category)`
  )) ?? [];
  return list.filter(Boolean).sort();
}

/* The image URL, built from the asset reference.
 *
 * A reference reads image-{id}-{width}x{height}-{format}, and the CDN
 * path is those pieces rearranged. Sized on request rather than served
 * at upload size — the audit found article heroes going out at
 * 5448 × 3632, which is the single largest page-speed cost on the site.
 */
export function imageUrl(
  ref: string | undefined | null,
  opts: { w?: number; h?: number; q?: number } = {}
) {
  if (!ref) return null;
  const [, id, dimensions, format] = ref.split('-');
  if (!id || !format) return null;

  const params = new URLSearchParams();
  if (opts.w) params.set('w', String(opts.w));
  if (opts.h) params.set('h', String(opts.h));
  params.set('q', String(opts.q ?? 78));
  params.set('auto', 'format');
  if (opts.w && opts.h) params.set('fit', 'crop');

  return `https://cdn.sanity.io/images/${PROJECT}/${DATASET}/`
    + `${id}-${dimensions}.${format}?${params}`;
}

/** Where an article's image is, at the size it is actually shown. */
export function heroUrl(a: Article, w: number, h?: number) {
  return imageUrl(a.heroImage?.asset?._ref, { w, h });
}

/** A category as a person would read it. The stored values are single
 *  lowercase words. */
export function categoryName(c: string | null) {
  if (!c) return null;
  // The sections are named — Form, Pulse, Portraits, The Compass — and
  // already carry their capitals. Only a value stored lowercase needs
  // help, and title-casing one that does not would turn "The Compass"
  // into "The compass".
  if (/[A-Z]/.test(c)) return c;
  return c.split(/[-\s]+/)
    .map((w, i) => i === 0 || w.length > 3
      ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}
