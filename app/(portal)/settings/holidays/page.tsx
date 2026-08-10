import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import HolidayManager from '@/components/HolidayManager';

export const dynamic = 'force-dynamic';

export default async function HolidaysPage() {
  const supabase = await createClient();

  // Only countries that actually have venues — syncing all 245 would be
  // 245 API calls for data nobody needs.
  const [{ data: venueCountries }, { data: holidays }] = await Promise.all([
    supabase.from('venue_list').select('country_id,country_name').not('country_id', 'is', null),
    supabase.from('public_holidays').select('country_code,source,holiday_date'),
  ]);

  const counts = new Map<number, { name: string; venues: number }>();
  (venueCountries ?? []).forEach((v: any) => {
    const e = counts.get(v.country_id) ?? { name: v.country_name, venues: 0 };
    e.venues += 1; counts.set(v.country_id, e);
  });

  const { data: countries } = await supabase
    .from('countries').select('id,name,iso_code')
    .in('id', Array.from(counts.keys()).slice(0, 200));

  const byCode = new Map<string, { total: number; manual: number; years: Set<number> }>();
  (holidays ?? []).forEach((h: any) => {
    const e = byCode.get(h.country_code) ?? { total: 0, manual: 0, years: new Set<number>() };
    e.total += 1;
    if (h.source === 'Manual') e.manual += 1;
    e.years.add(new Date(h.holiday_date).getFullYear());
    byCode.set(h.country_code, e);
  });

  const rows = (countries ?? []).map((c: any) => ({
    ...c,
    venues: counts.get(c.id)?.venues ?? 0,
    loaded: byCode.get(c.iso_code)?.total ?? 0,
    manual: byCode.get(c.iso_code)?.manual ?? 0,
    years: Array.from(byCode.get(c.iso_code)?.years ?? []).sort(),
  })).sort((a, b) => b.venues - a.venues);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/settings">Settings</Link> · Public holidays
      </div>

      <div className="ph">
        <div>
          <h2>Public holidays</h2>
          <div className="ph-sub">
            {rows.length} countries with venues · {(holidays ?? []).length} holidays loaded
          </div>
        </div>
      </div>

      <HolidayManager rows={rows} />
    </div></div>
  );
}
