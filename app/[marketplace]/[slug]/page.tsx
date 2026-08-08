import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/* The venue page, not yet built.
 *
 * A card that links nowhere is worse than a card that links to a page
 * saying "not yet" — a 404 reads as a broken site, and this reads as one
 * that is being built. It also means the routes and the slugs can be
 * proved right before the page exists.
 *
 * /retreat-venues/[slug] and /wellness-venues/[slug], both handled here
 * so the marketplace stays in the URL where it belongs for SEO. */

const MARKETPLACES: Record<string, string> = {
  'retreat-venues': 'Retreat',
  'wellness-venues': 'Wellness',
};

async function findVenue(marketplace: string, slug: string) {
  const kind = MARKETPLACES[marketplace];
  if (!kind) return null;

  const supabase = await createClient();
  const { data } = await supabase.from('venue_cards')
    .select('*').eq('marketplace', kind).eq('listing_slug', slug).maybeSingle();

  return data as Record<string, any> | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ marketplace: string; slug: string }>;
}): Promise<Metadata> {
  const { marketplace, slug } = await params;
  const v = await findVenue(marketplace, slug);

  if (!v) return { title: 'Not found' };

  // Its own title and description, per venue. At six thousand venues
  // that is six thousand pages each able to rank for its own name and
  // place — which is the whole point of a page per venue.
  const place = [v.city, v.country].filter(Boolean).join(', ');

  return {
    title: `${v.headline ?? v.venue_name}${place ? ` — ${place}` : ''}`,
    description: v.listing_description ?? v.venue_short_description ?? undefined,
    alternates: { canonical: `/${marketplace}/${slug}` },
  };
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ marketplace: string; slug: string }>;
}) {
  const { marketplace, slug } = await params;
  const v = await findVenue(marketplace, slug);
  if (!v) notFound();

  const place = [v.what_they_call_it ?? v.locality, v.city, v.country]
    .filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i)
    .join(', ');

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb">
            <Link href="/venues">Venues</Link>
            {v.country && <> · <Link href={`/venues?country=${v.country_slug}`}>{v.country}</Link></>}
          </div>
          <div className="eyebrow" style={{ marginTop: 'var(--s4)' }}>{v.venue_type}</div>
          <h1>{v.headline ?? v.venue_name}</h1>
          <p className="page-sub">{place}</p>
        </div>
      </section>

      <div className="wrap">
        {v.image_url && (
          <img src={v.image_url} alt=""
            style={{ width: '100%', aspectRatio: '21 / 9', objectFit: 'cover',
                     marginBottom: 'var(--s6)' }} />
        )}

        <div style={{ maxWidth: 680 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75 }}>
            {v.listing_description ?? v.venue_short_description}
          </p>
        </div>

        <div className="empty" style={{ marginTop: 'var(--s6)' }}>
          <h2>This page is still being built</h2>
          <p>
            The full record &mdash; spaces, accommodation, what is offered, the
            setting and how to enquire &mdash; is coming. In the meantime we can
            answer anything about {v.venue_name} directly.
          </p>
          <Link className="btn-solid" href="/contact">Ask us about this venue</Link>
        </div>
      </div>
    </>
  );
}
