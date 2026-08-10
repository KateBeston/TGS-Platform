import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SchedulingEditor from '@/components/SchedulingEditor';

export const dynamic = 'force-dynamic';

export default async function SchedulingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name,country_id,countries(iso_code,name)')
    .eq('id', venueId).single();
  if (!venue) notFound();

  const code = (venue as any).countries?.iso_code;
  const thisYear = new Date().getFullYear();

  const [{ data: scheduling }, { data: breaks }, { data: services },
         { data: holidays }, { data: overrides }, { data: closures }] = await Promise.all([
    supabase.from('venue_scheduling').select('*').eq('venue_id', venueId).maybeSingle(),
    supabase.from('venue_breaks').select('*').eq('venue_id', venueId)
      .order('day_of_week', { nullsFirst: true }).order('starts_at'),
    supabase.from('venue_services').select('id,name,duration_minutes,buffer_minutes')
      .eq('venue_id', venueId).order('name'),
    code
      ? supabase.from('public_holidays').select('*').eq('country_code', code)
          .gte('holiday_date', `${thisYear}-01-01`).lte('holiday_date', `${thisYear + 1}-12-31`)
          .order('holiday_date')
      : Promise.resolve({ data: [] }),
    supabase.from('venue_holiday_overrides').select('*').eq('venue_id', venueId),
    supabase.from('venue_closures').select('*').eq('venue_id', venueId).order('date_from'),
  ]);

  return (
    <SchedulingEditor
      venueId={venueId}
      countryCode={code ?? null}
      countryName={(venue as any).countries?.name ?? null}
      scheduling={scheduling}
      breaks={breaks ?? []}
      services={services ?? []}
      holidays={holidays ?? []}
      overrides={overrides ?? []}
      closures={closures ?? []}
    />
  );
}
