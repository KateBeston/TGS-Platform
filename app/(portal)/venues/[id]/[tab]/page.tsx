import { notFound, redirect } from 'next/navigation';
import { intakeSummary } from '@/app/actions/venueIntake';
import { createClient } from '@/lib/supabase/server';
import { VENUE_TABS, getTab } from '@/lib/venueSchema';
import VenueGroups from '@/components/VenueGroups';
import ChildTable from '@/components/ChildTable';
import GeographyPicker from '@/components/GeographyPicker';
import VenueMap from '@/components/VenueMap';
import PracticeFlagPanel from '@/components/PracticeFlags';
import IntakeBanner from '@/components/IntakeBanner';
import TravelTimes from '@/components/TravelTimes';
import LocalAreaHarvest from '@/components/LocalAreaHarvest';
import PlacePicker from '@/components/PlacePicker';
import ConfirmPlacement from '@/components/ConfirmPlacement';
import PackageEditor from '@/components/PackageEditor';
import ReadOnePage from '@/components/ReadOnePage';
import { packagesFor, servicesFor } from '@/app/actions/packages';
import { placeOf } from '@/app/actions/geography';

export const dynamic = 'force-dynamic';

export default async function VenueTabPage({
  params, searchParams,
}: {
  params: Promise<{ id: string; tab: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id, tab } = await params;
  const sp = await searchParams;
  const venueId = Number(id);
  const def = getTab(tab);
  // listings and media have dedicated pages
  if (!def || ['listings','media','content','subscription','taxonomy','facilities',
               'related','reviews','scheduling'].includes(tab)) notFound();

  const supabase = await createClient();
  const { data: venue } = await supabase
    .from('venues')
    .select('*, cities(name), states(name), countries(name)')
    .eq('id', venueId).single();
  if (!venue) notFound();

  // lookups only where the tab actually uses one
  const needsTypes = (def.groups ?? []).some(g => g.fields.some(f => f.lookup === 'venue_types'));
  // Child tables declare lookups too — the wellness services tab points
  // at the modality taxonomy, and a select with no options is a field
  // that cannot be filled.
  const needsTaxonomy = (def.children ?? [])
    .some(c => c.fields.some(f => f.lookup === 'modality_practices'
                               || f.lookup === 'modality_categories'));
  const needsSettings = (def.children ?? [])
    .some(c => c.fields.some(f => f.lookup === 'venue_settings'));
  const needsClimate = (def.groups ?? [])
    .some(g => g.fields.some(f => f.lookup === 'climate_types'));
  const needsBrands = (def.children ?? [])
    .some(c => c.fields.some(f => f.lookup === 'venue_brands'));

  const [{ data: types }, { data: countries }, { data: practices },
         { data: modCategories }, { data: settingList }, { data: climates },
         { data: brandList }] =
    await Promise.all([
      needsTypes ? supabase.from('venue_types').select('id,name').order('name')
                 : Promise.resolve({ data: [] }),
      tab === 'location' ? supabase.from('countries').select('id,name').order('name')
                         : Promise.resolve({ data: [] }),
      needsTaxonomy
        ? supabase.from('modality_practices')
            .select('id,name,modality_categories(name)').order('name')
        : Promise.resolve({ data: [] }),
      needsTaxonomy
        ? supabase.from('modality_categories').select('id,name').order('display_order')
        : Promise.resolve({ data: [] }),
      needsSettings
        ? supabase.from('venue_settings').select('id,name').order('name')
        : Promise.resolve({ data: [] }),
      needsClimate
        ? supabase.from('climate_types').select('id,name').order('display_order')
        : Promise.resolve({ data: [] }),
      needsBrands
        ? supabase.from('venue_brands').select('id,name').order('name')
        : Promise.resolve({ data: [] }),
    ]);


  // Practices are prefixed with their category, because "Sound Bath" and
  // "Steam & Sauna Rituals" mean different things in a list of 106.
  const lookups = {
    venue_types: types ?? [],
    modality_practices: (practices ?? []).map((p: any) => ({
      id: p.id,
      name: `${(p as any).modality_categories?.name ?? '—'} · ${p.name}`,
    })),
    modality_categories: modCategories ?? [],
    venue_settings: settingList ?? [],
    climate_types: climates ?? [],
    venue_brands: brandList ?? [],
  };

  // child rows for this tab, in one pass
  const children = def.children ?? [];
  // Packages need their items and the venue's services, which the
  // generic child table cannot load — it does one level.
  const [packageRows, serviceRows] = tab === 'pricing'
    ? await Promise.all([packagesFor(venueId), servicesFor(venueId)])
    : [[], []];

  // The venue's spaces, so services read from a spa page can be put in
  // the spa rather than loose on the venue.
  const { data: spaceRows } = ['services', 'pricing'].includes(tab)
    ? await supabase.from('venue_spaces')
        .select('id,name,venue_brands(name)').eq('venue_id', venueId).order('name')
    : { data: [] };

  const venueSpaces = (spaceRows ?? []).map((sp: any) => ({
    id: sp.id, name: sp.name, operator: sp.venue_brands?.name ?? null,
  }));

  const place = tab === 'location'
    ? await placeOf(venueId)
    : { continent_id: null, country_id: null, state_id: null, city_id: null };
  // Not every child table carries display_order — venue_dining, rate_plans
  // and venue_booking_settings do not. Try it, fall back to id.
  const childData = await Promise.all(
    children.map(async (c) => {
      const ordered = await supabase
        .from(c.table).select('*').eq('venue_id', venueId)
        .order('display_order', { nullsFirst: false }).order('id');
      if (!ordered.error) return ordered.data ?? [];
      const plain = await supabase
        .from(c.table).select('*').eq('venue_id', venueId).order('id');
      return plain.data ?? [];
    })
  );


  // What the practices offered here carry. Shown on the tab rather than
  // buried in a catalogue, because it is at the venue that somebody has
  // to do something about it.
  const { data: serviceFlags } = tab === 'services'
    ? await supabase
        .from('practice_risk')
        .select('*')
        .in('practice_id',
          (childData[0] ?? []).map((r: any) => r.practice_id).filter(Boolean))
    : { data: null };

  // Shown once on arrival from a website read, then dismissed. Where the
  // venue came from matters for a few minutes and then stops mattering.
  const summary = sp.from === 'intake' ? await intakeSummary(venueId) : null;

  return (
    <div className="content"><div className="wrap">
      {summary && <IntakeBanner summary={summary as any} venueId={venueId} />}

      <div className="ph">
        <div>
          <h2>{def.label}</h2>
          {def.blurb && <div className="ph-sub">{def.blurb}</div>}
        </div>
      </div>

      {tab === 'location' && (
        <div className="sect">
          <h3>On the map</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Drawn from the coordinates, not from a stored link — so it cannot drift out of step
            with a corrected address
          </div>
          <VenueMap place={{
            name: venue.venue_name,
            latitude: venue.latitude,
            longitude: venue.longitude,
            entrance_latitude: venue.entrance_latitude,
            entrance_longitude: venue.entrance_longitude,
            street_address: venue.street_address,
            postcode: venue.postcode,
            city: (venue as any).cities?.name,
            state: (venue as any).states?.name,
            country: (venue as any).countries?.name,
            google_place_id: venue.google_place_id,
          }} />
          {venue.directions_note && (
            <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
              <strong>Getting there:</strong> {venue.directions_note}
            </div>
          )}
        </div>
      )}

      {tab === 'location' && (
        <div className="sect">
          <h3>Harvest the local area</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Reads the venue&rsquo;s coordinates and finds nearby airports, stations, towns and
            attractions with real driving times. Review the suggestions and apply the ones that fit.
          </div>
          <LocalAreaHarvest venueId={venueId}
            hasCoords={venue.latitude != null && venue.longitude != null} />
        </div>
      )}

      {tab === 'location' && (
        <div className="sect">
          <h3>Geography</h3>
          <div className="grid">
            <GeographyPicker venueId={venueId} countries={countries ?? []}
              countryId={venue.country_id} stateId={venue.state_id} cityId={venue.city_id} />
          </div>
        </div>
      )}

      {tab === 'services' && !!serviceFlags?.length && (
        <div className="sect">
          <h3>What these practices carry</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            From the taxonomy. Shown here because it is at the venue that somebody has to act on it
          </div>
          {Object.entries(
            serviceFlags.reduce((acc: Record<string, any[]>, f: any) => {
              (acc[f.practice] ||= []).push(f);
              return acc;
            }, {}),
          ).map(([practice, flags]) => (
            <div key={practice} style={{ marginBottom: 'var(--s4)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{practice}</div>
              <div style={{ marginTop: 5 }}>
                <PracticeFlagPanel flags={flags as any} practiceName={practice} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!!def.groups?.length && (
        <VenueGroups venueId={venueId} venue={venue} groups={def.groups}
          lookups={lookups} />
      )}

      {['services', 'accommodation', 'spaces', 'pricing'].includes(tab) && (
        <ReadOnePage venueId={venueId} spaces={venueSpaces} />
      )}

      {tab === 'pricing' && (
        <PackageEditor venueId={venueId} packages={packageRows} services={serviceRows} />
      )}

      {tab === 'location' && <PlacePicker venueId={venueId} initial={place} />}
      {tab === 'location' && <ConfirmPlacement venue={venue} />}

      {tab === 'location' && (() => {
        const rows = childData[children.findIndex(
          (c: any) => c.table === 'venue_distances')] ?? [];
        return (
          <TravelTimes venueId={venueId} count={rows.length}
            calculated={rows.filter((r: any) => r.travel_source === 'Calculated').length} />
        );
      })()}

      {children.map((c, i) => (
        <ChildTable key={c.table} venueId={venueId} def={c} rows={childData[i]}
                    lookups={lookups} />
      ))}
    </div></div>
  );
}
