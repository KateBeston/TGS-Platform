import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import VenueSectionNav from '@/components/VenueSectionNav';
import VenueLogo from '@/components/VenueLogo';
import RereadButton from '@/components/RereadButton';
import LocationSwitcher from '@/components/LocationSwitcher';
import { siblingLocations } from '@/app/actions/brands';

export default async function VenueLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: venue } = await supabase
    .from('venues')
    .select('id,venue_name,logo_url,logo_source,website_url,last_intake_at')
    .eq('id', Number(id)).single();

  if (!venue) notFound();

  // The other locations under the same brand, so Melbourne and Tokyo are
  // one click apart rather than a list apart.
  const family = await siblingLocations(venue.id);

  return (
    <>
      <div style={{ padding: 'var(--s5) var(--s6) 0' }}>
        <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
          <Link href="/venues">Venues</Link>
        </div>

        <VenueSectionNav id={venue.id} />

        {/* The venue, said once, beneath the tabs and above whatever
            section follows. Their own mark rather than ours — contained
            rather than cropped, because a wordmark and a round badge are
            both logos and cropping takes the edges off one of them. */}
        <div style={{ display: 'flex', alignItems: 'center',
                      gap: 'var(--s4)', padding: 'var(--s5) 0 0' }}>
          <VenueLogo venueId={venue.id} logoUrl={venue.logo_url}
                     source={venue.logo_source} />
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 38,
                       fontWeight: 300, margin: 0, letterSpacing: '0.004em',
                       lineHeight: 1.1 }}>
            {venue.venue_name ?? 'Untitled'}
          </h1>

          {/* Put where somebody notices a record is stale — while looking
              at it, rather than after navigating to a tab about reading. */}
          <div style={{ marginLeft: 'auto', display: 'flex',
                        alignItems: 'center', gap: 'var(--s3)' }}>
            {family && (
              <LocationSwitcher venueId={venue.id} brand={family.brand}
                                locations={family.locations as any} />
            )}
            <RereadButton venueId={venue.id}
                          hasWebsite={!!venue.website_url}
                          lastRead={venue.last_intake_at} />
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
