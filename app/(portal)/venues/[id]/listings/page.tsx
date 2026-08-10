import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CreateListing from '@/components/CreateListing';

export const dynamic = 'force-dynamic';

export default async function VenueListingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from('venue_listings').select('*').eq('venue_id', venueId).order('marketplace');

  const existing = new Set((listings ?? []).map((l: any) => l.marketplace));

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Listings</h2>
          <div className="ph-sub">
            How this venue appears publicly. One listing per marketplace, over one set of facts.
          </div>
        </div>
      </div>

      <div className="note">
        <strong>Facts stay on the venue record.</strong> A listing adds headline, description,
        imagery, metadata and publish state. Creating a second listing does not duplicate the venue.
      </div>

      {!listings?.length && (
        <div className="note">No listing records for this venue.</div>
      )}

      {!!listings?.length && (
        <table style={{ marginBottom: 'var(--s6)' }}>
          <thead><tr><th>Marketplace</th><th>Headline</th><th>Status</th><th>Slug</th></tr></thead>
          <tbody>
            {listings.map((l: any) => (
              <tr key={l.id}>
                <td><span className="pill">{l.marketplace}</span></td>
                <td>
                  <Link href={`/listings/${l.id}`} style={{ textDecoration: 'none' }}>
                    <span className="v-name">{l.headline ?? 'Untitled'}</span>
                  </Link>
                </td>
                <td>{l.is_published
                  ? <span className="pill gold">Published</span>
                  : <span className="pill empty">{l.listing_status ?? 'Draft'}</span>}</td>
                <td className="v-slug">{l.slug ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CreateListing venueId={venueId}
        canRetreat={!existing.has('Retreat')} canWellness={!existing.has('Wellness')} />
    </div></div>
  );
}
