import { createClient } from '@/lib/supabase/server';
import Donut from '@/components/Donut';
import BarList from '@/components/BarList';

export const dynamic = 'force-dynamic';

export default async function VenuesAnalyticsPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('venue_list')
    .select('id,country_name,venue_type_name,category_label,tier_name,max_guests,price_from,latitude,state_id,city_id')
    .limit(6000);

  const v = rows ?? [];

  const tally = (key: string, fallback: string) => {
    const m = new Map<string, number>();
    for (const r of v) {
      const k = ((r as any)[key] ?? '').toString().trim() || fallback;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m, ([label, value]) => ({ label, value }));
  };

  const countries = tally('country_name', 'No country').filter((r) => r.label !== 'No country');
  const noCountry = v.filter((r: any) => !r.country_name).length;

  const capacityBands = [
    { label: 'Up to 10', value: v.filter((r: any) => r.max_guests > 0 && r.max_guests <= 10).length },
    { label: '11 to 20', value: v.filter((r: any) => r.max_guests > 10 && r.max_guests <= 20).length },
    { label: '21 to 40', value: v.filter((r: any) => r.max_guests > 20 && r.max_guests <= 40).length },
    { label: '41 to 80', value: v.filter((r: any) => r.max_guests > 40 && r.max_guests <= 80).length },
    { label: 'Over 80', value: v.filter((r: any) => r.max_guests > 80).length },
    { label: 'Not recorded', value: v.filter((r: any) => !r.max_guests).length },
  ];

  const gaps = [
    { label: 'No country', value: noCountry },
    { label: 'No state', value: v.filter((r: any) => !r.state_id).length },
    { label: 'No city', value: v.filter((r: any) => !r.city_id).length },
    { label: 'No venue type', value: v.filter((r: any) => !r.venue_type_name).length },
    { label: 'No category', value: v.filter((r: any) => !r.category_label).length },
    { label: 'No coordinates', value: v.filter((r: any) => !r.latitude).length },
    { label: 'No capacity', value: v.filter((r: any) => !r.max_guests).length },
  ];

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="v">{v.length.toLocaleString('en-AU')}</div>
          <div className="l">Venues</div>
        </div>
        <div className="stat">
          <div className="v">{countries.length}</div>
          <div className="l">Countries represented</div>
        </div>
        <div className="stat">
          <div className={`v ${!v.filter((r: any) => r.tier_name).length ? 'zero' : ''}`}>
            {v.filter((r: any) => r.tier_name).length}
          </div>
          <div className="l">On a subscription</div>
        </div>
        <div className="stat">
          <div className="v">{v.filter((r: any) => r.venue_type_name).length.toLocaleString('en-AU')}</div>
          <div className="l">Classified</div>
        </div>
      </div>

      <div className="sect">
        <h3>Category</h3>
        <Donut slices={tally('category_label', 'Not set')} empty="No categories set." />
      </div>

      <div className="sect">
        <h3>Depth by country</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          Where the catalogue is deep enough for a hub page to be worth publishing
        </div>
        <BarList rows={countries.slice(0, 20)} unit="venues" empty="No countries recorded." />
      </div>

      <div className="sect">
        <h3>Venue types</h3>
        <BarList rows={tally('venue_type_name', 'Not set').filter((r) => r.label !== 'Not set').slice(0, 20)}
                 unit="venues" empty="No venue types assigned." />
      </div>

      <div className="sect">
        <h3>Capacity</h3>
        <BarList rows={capacityBands} unit="venues" />
      </div>

      <div className="sect">
        <h3>What is missing</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          The enrichment worklist, by size. Filter the venue list by data status to work through any
          of these.
        </div>
        <BarList rows={gaps} unit="venues" />
      </div>
    </>
  );
}
