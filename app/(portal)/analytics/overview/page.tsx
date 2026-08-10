import { createClient } from '@/lib/supabase/server';
import Donut from '@/components/Donut';
import BarList from '@/components/BarList';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const supabase = await createClient();

  const head = (t: string) => supabase.from(t).select('*', { count: 'exact', head: true });

  const [venues, contacts, listings, published, enquiries, bookings, subs, legal, tags] =
    await Promise.all([
      head('venues'), head('contacts'), head('venue_listings'),
      supabase.from('venue_listings').select('*', { count: 'exact', head: true }).eq('is_published', true),
      head('enquiries'), head('bookings'), head('venue_subscriptions'),
      head('legal_documents'), head('contact_tags'),
    ]);

  // Catalogue readiness — the honest picture of how much of the 5,886 is
  // actually usable, rather than how many rows exist.
  const [withCountry, withState, withType, withCoords, withCategory] = await Promise.all([
    supabase.from('venues').select('*', { count: 'exact', head: true }).not('country_id', 'is', null),
    supabase.from('venues').select('*', { count: 'exact', head: true }).not('state_id', 'is', null),
    supabase.from('venues').select('*', { count: 'exact', head: true }).not('venue_type_id', 'is', null),
    supabase.from('venues').select('*', { count: 'exact', head: true }).not('latitude', 'is', null),
    supabase.from('venues').select('*', { count: 'exact', head: true }).neq('venue_category', '{}'),
  ]);

  const total = venues.count ?? 0;
  const stat = (v: number | null) => ({ value: v ?? 0, zero: !v });

  const headline = [
    { label: 'Venues catalogued', ...stat(venues.count) },
    { label: 'Contacts', ...stat(contacts.count) },
    { label: 'Listings published', ...stat(published.count) },
    { label: 'Open enquiries', ...stat(enquiries.count) },
    { label: 'Bookings', ...stat(bookings.count) },
    { label: 'Subscriptions', ...stat(subs.count) },
  ];

  const readiness = [
    { label: 'Country set', value: withCountry.count ?? 0 },
    { label: 'Venue type set', value: withType.count ?? 0 },
    { label: 'Category set', value: withCategory.count ?? 0 },
    { label: 'Coordinates set', value: withCoords.count ?? 0 },
    { label: 'State set', value: withState.count ?? 0 },
  ];

  const pipeline = [
    { label: 'Catalogued, not listed', value: total - (listings.count ?? 0) },
    { label: 'Listed, not published', value: (listings.count ?? 0) - (published.count ?? 0) },
    { label: 'Published', value: published.count ?? 0 },
  ];

  return (
    <>
      <div className="stats">
        {headline.map((c) => (
          <div className="stat" key={c.label}>
            <div className={`v ${c.zero ? 'zero' : ''}`}>{c.value.toLocaleString('en-AU')}</div>
            <div className="l">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="sect">
        <h3>Catalogue readiness</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          How much of the {total.toLocaleString('en-AU')} is actually usable, rather than how many
          rows exist. State is the one blocking location pages below country level.
        </div>
        <BarList rows={readiness} unit={`of ${total.toLocaleString('en-AU')}`} />
      </div>

      <div className="sect">
        <h3>Listing pipeline</h3>
        <Donut slices={pipeline} empty="No venues catalogued." />
      </div>

      <div className="sect">
        <h3>Elsewhere</h3>
        <table>
          <tbody>
            <tr><td style={{ width: 260, color: 'var(--ink-quiet)' }}>Legal documents</td>
              <td>{legal.count ?? 0}</td></tr>
            <tr><td style={{ color: 'var(--ink-quiet)' }}>ActiveCampaign tags catalogued</td>
              <td>{tags.count ?? 0}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
