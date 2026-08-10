import { createClient } from '@/lib/supabase/server';
import { settingCatalogue, venueSettings } from '@/app/actions/settings';
import SettingEditor from '@/components/SettingEditor';

export const dynamic = 'force-dynamic';

export default async function VenueSettingPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const [catalogue, { links, inherited }, { data: prose }] = await Promise.all([
    settingCatalogue(),
    venueSettings(venueId),
    supabase.from('venue_setting_prose').select('*').eq('venue_id', venueId).maybeSingle(),
  ]);

  return (
    <SettingEditor
      venueId={venueId}
      catalogue={catalogue}
      links={links}
      inherited={inherited}
      prose={prose ?? null}
    />
  );
}
