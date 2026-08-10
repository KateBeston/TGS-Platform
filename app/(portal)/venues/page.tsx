import Link from 'next/link';
import { listSavedSearches, searchOptions } from '@/app/actions/search';
import VenueSearchPanel from '@/components/VenueSearchPanel';
import { createClient } from '@/lib/supabase/server';
import VenueFilters from '@/components/VenueFilters';
import Pager from '@/components/Pager';

export const dynamic = 'force-dynamic';

const SIZES = [10, 25, 50, 100, 250];

/** Sort options. `column` is the venues column; related tables cannot be
 *  sorted on directly through the API, so country sorting uses country_id
 *  and is labelled accordingly. */
const SORTS: Record<string, { label: string; column: string; asc: boolean }> = {
  name_asc:     { label: 'Name · A to Z',            column: 'venue_name',      asc: true },
  name_desc:    { label: 'Name · Z to A',            column: 'venue_name',      asc: false },
  price_asc:    { label: 'Price · lowest first',     column: 'price_from',      asc: true },
  price_desc:   { label: 'Price · highest first',    column: 'price_from',      asc: false },
  category_asc: { label: 'Category',                  column: 'category_label',  asc: true },
  tier_asc:     { label: 'Subscription tier',        column: 'tier_order',      asc: true },
  tier_price:   { label: 'Tier price · lowest first', column: 'tier_monthly_price', asc: true },
  updated_desc: { label: 'Recently updated',         column: 'updated_at',      asc: false },
  created_desc: { label: 'Recently added',           column: 'created_at',      asc: false },
  created_asc:  { label: 'Oldest first',             column: 'created_at',      asc: true },
  country_asc:  { label: 'Country · A to Z',         column: 'country_name',    asc: true },
  guests_desc:  { label: 'Largest capacity',         column: 'max_guests',      asc: false },
};

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; page?: string; size?: string; sort?: string;
    country?: string; type?: string; needs?: string; tier?: string; cat?: string;
    archived?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const sortKey = sp.sort && SORTS[sp.sort] ? sp.sort : 'name_asc';
  const sort = SORTS[sortKey];
  const country = sp.country ?? '';
  const type = sp.type ?? '';
  const needs = sp.needs ?? '';
  const tier = sp.tier ?? '';
  const cat = sp.cat ?? '';
  // Archived venues are out of venue_list entirely, so seeing them means
  // reading the table directly.
  const showArchived = sp.archived === '1';

  const size = SIZES.includes(Number(sp.size)) ? Number(sp.size) : 50;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * size;

  const supabase = await createClient();

  // The advanced search, which existed as a component and was wired to
  // no page at all.
  const [options, saved] = await Promise.all([
    searchOptions(), listSavedSearches(),
  ]);

  // venue_list flattens type, geography, tier and price, so sorting on any
  // of them is a plain column order rather than a nested join per request.
  let query = supabase
    .from(showArchived ? 'venues' : 'venue_list')
    .select(showArchived
      ? 'id,venue_name,slug,venue_category,venue_type_id,country_id,city_id,'
        + 'price_from,price_currency,max_guests,archived_at,archived_reason'
      : '*', { count: 'exact' })
    .order(sort.column, { ascending: sort.asc, nullsFirst: false })
    .order('venue_name')
    .range(from, from + size - 1);

  if (showArchived) query = query.not('archived_at', 'is', null);

  if (q) query = query.ilike('venue_name', `%${q}%`);
  if (country) query = query.eq('country_id', Number(country));
  if (type) query = query.eq('venue_type_id', Number(type));

  // Enrichment filters. With 1,539 venues missing a country and most
  // missing a type, "what still needs work" is the most useful filter here.
  if (needs === 'country') query = query.is('country_id', null);
  if (needs === 'state')   query = query.is('state_id', null);
  if (needs === 'city')    query = query.is('city_id', null);
  if (needs === 'type')    query = query.is('venue_type_id', null);
  if (needs === 'coords')  query = query.is('latitude', null);
  if (needs === 'contact') query = query.is('contact_email', null);
  // contains / not-contains on the array; 'both' means it holds two entries
  if (cat === 'Retreat' || cat === 'Wellness') query = query.contains('venue_category', [cat]);
  else if (cat === 'both')  query = query.contains('venue_category', ['Retreat', 'Wellness']);
  else if (cat === 'none')  query = query.eq('venue_category', '{}');

  if (tier === 'none')      query = query.is('tier_id', null);
  else if (tier)            query = query.eq('tier_id', Number(tier));

  if (needs === 'complete') {
    query = query
      .not('country_id', 'is', null)
      .not('venue_type_id', 'is', null)
      .not('latitude', 'is', null);
  }

  const [{ data, error, count }, { data: countries }, { data: types }, { data: tiers }] =
    await Promise.all([
      query,
      supabase.from('countries').select('id,name').order('name'),
      supabase.from('venue_types').select('id,name').order('name'),
      supabase.from('subscription_tiers')
        .select('id,name,monthly_price').order('display_order'),
    ]);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const showingTo = Math.min(from + size, total);
  const filtered = !!(q || country || type || needs || tier || cat);

  return (
    <div className="content">
      <div className="ph">
        <div>
          <h2>Venues</h2>
          <div className="ph-sub">
            {total.toLocaleString('en-AU')} record{total === 1 ? '' : 's'}
            {filtered && ' matching filters'}
            {total > 0 && ` · showing ${(from + 1).toLocaleString('en-AU')}–${showingTo.toLocaleString('en-AU')}`}
          </div>
        </div>
        <div className="ph-act">
          <Link className="btn quiet" href="/venues/brands">Brands</Link>
          <Link className="btn" href="/venues/new">Add a venue</Link>
          <Link className="btn quiet" href="/venues/intake">Site reads</Link>
          <Link className="btn quiet" href="/venues/links">Links</Link>
          <Link className="btn quiet" href="/venues/duplicates">Duplicates</Link>
          <Link className={`btn ${showArchived ? '' : 'quiet'}`}
                href={showArchived ? '/venues' : '/venues?archived=1'}>
            {showArchived ? 'Back to the list' : 'Archived'}
          </Link>
          <Link className="btn quiet" href="/venues/harvest">Harvest websites</Link>
          <Link className="btn quiet" href="/venues/geocode">Verify coordinates</Link>
        </div>
      </div>

      <VenueFilters
        q={q} sortKey={sortKey} country={country} type={type} needs={needs}
        tier={tier} cat={cat} size={size}
        sorts={Object.entries(SORTS).map(([k, v]) => ({ key: k, label: v.label }))}
        countries={countries ?? []} types={types ?? []} tiers={tiers ?? []}
      />

      {error && <div className="note bad"><strong>Query failed.</strong> {error.message}</div>}

      <Pager page={page} pages={pages} size={size} sizes={SIZES} total={total} params={sp} />

      {!!data?.length && (
        <table>
          <thead>
            <tr>
              <th>Venue</th><th>Category</th><th>Type</th><th>Country</th>
              <th>City</th><th>Tier</th><th>Price from</th><th>Guests</th><th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((v: any) => (
              <tr key={v.id}>
                <td>
                  <Link href={`/venues/${v.id}/details`} style={{ textDecoration: 'none' }}>
                    <div className="v-name">{v.venue_name ?? 'Untitled'}</div>
                    <div className="v-slug">{v.slug ?? 'no slug'}</div>
                  </Link>
                </td>
                <td>
                  {showArchived
                    ? <>
                        <span className="pill" style={{ borderColor: 'var(--muted)',
                                                        color: 'var(--muted)' }}>Archived</span>
                        <div className="v-slug" style={{ marginTop: 3, maxWidth: 220 }}>
                          {v.archived_reason}
                        </div>
                      </>
                    : v.category_label
                      ? <span className="pill">{v.category_label}</span>
                      : <span className="pill empty">Unset</span>}
                </td>
                <td>{v.venue_type_name ?? <span className="pill empty">Unset</span>}</td>
                <td>{v.country_name ?? <span className="pill empty">None</span>}</td>
                <td>{v.city_name ?? <span className="pill empty">None</span>}</td>
                <td>{v.tier_name
                  ? <span className="pill gold">{v.tier_name}</span>
                  : <span className="pill empty">None</span>}</td>
                <td>{v.price_from != null
                  ? `${v.price_currency ?? ''} ${Number(v.price_from).toLocaleString('en-AU')}`.trim()
                  : <span className="pill empty">—</span>}</td>
                <td>{v.max_guests ?? <span className="pill empty">—</span>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {/* A link rather than a button — archiving asks for a
                      reason, and a reason is not something to type into a
                      table row. */}
                  <Link className="link-btn" href={`/venues/${v.id}/archive`}>
                    {showArchived ? 'Restore' : 'Archive'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!data?.length && !error && (
        <div className="note" style={{ marginTop: 'var(--s5)' }}>
          {filtered ? 'No records match these filters.' : 'No records.'}
        </div>
      )}

      {pages > 1 && (
        <div style={{ marginTop: 'var(--s5)' }}>
          <Pager page={page} pages={pages} size={size} sizes={SIZES} total={total} params={sp} />
        </div>
      )}
    </div>
  );
}
