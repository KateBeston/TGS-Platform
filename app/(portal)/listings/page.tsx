import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ListingsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; marketplace?: string }> }) {
  const { q, marketplace } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('venue_listings')
    .select('id,slug,headline,marketplace,listing_status,is_published,content_updated_at,venues(id,venue_name)')
    .order('updated_at', { ascending: false })
    .limit(60);

  if (marketplace) query = query.eq('marketplace', marketplace);
  if (q) query = query.ilike('headline', `%${q}%`);

  const { data, error } = await query;

  return (
    <div className="content">
      <div className="ph">
        <div>
          <h2>Listings</h2>
          <div className="ph-sub">
            Public-facing records. Table: <code>venue_listings</code> — one row per venue per marketplace.
          </div>
        </div>
      </div>

      <div className="note">
        <strong>Listings are presentation, not facts.</strong> Capacity, spaces, facilities and
        contacts are held once on the venue record and read from there. This section controls
        headline, description, imagery, metadata and publish state only.
      </div>

      <form style={{ display: 'flex', gap: 'var(--s3)', marginBottom: 'var(--s5)' }}>
        <input name="q" defaultValue={q ?? ''} placeholder="Search headline"
          style={{ flex: 1, background: 'var(--warm-white)', border: '1px solid var(--border-input)', padding: '14px' }} />
        <select name="marketplace" defaultValue={marketplace ?? ''}
          style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)', padding: '14px' }}>
          <option value="">All marketplaces</option>
          <option value="Retreat">Retreat</option>
          <option value="Wellness">Wellness</option>
        </select>
        <button className="btn quiet" type="submit">Filter</button>
      </form>

      {error && <div className="note bad"><strong>Query failed.</strong> {error.message}</div>}

      {!data?.length && !error && (
        <div className="note">
          No listing records. Listings are created from a venue record — open a venue and use
          the Listings tab.
        </div>
      )}

      {!!data?.length && (
        <table>
          <thead>
            <tr>
              <th>Listing</th><th>Venue record</th><th>Marketplace</th>
              <th>Status</th><th>Slug</th>
            </tr>
          </thead>
          <tbody>
            {data.map((l: any) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/listings/${l.id}`} style={{ textDecoration: 'none' }}>
                    <div className="v-name">{l.headline ?? 'Untitled listing'}</div>
                  </Link>
                </td>
                <td>
                  {l.venues
                    ? <Link href={`/venues/${l.venues.id}/details`} style={{ color: 'var(--ink-gold)' }}>
                        {l.venues.venue_name}
                      </Link>
                    : <span className="pill empty">Unlinked</span>}
                </td>
                <td><span className="pill">{l.marketplace}</span></td>
                <td>
                  {l.is_published
                    ? <span className="pill gold">Published</span>
                    : <span className="pill empty">{l.listing_status ?? 'Draft'}</span>}
                </td>
                <td className="v-slug">{l.slug ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
