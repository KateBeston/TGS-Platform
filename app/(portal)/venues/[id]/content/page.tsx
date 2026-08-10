import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tabsFor } from '@/lib/listingTabs';
import TabContentEditor from '@/components/TabContentEditor';

export const dynamic = 'force-dynamic';

export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name,venue_category').eq('id', venueId).single();
  if (!venue) notFound();

  const [{ data: content }, { data: media }, { data: prose }] = await Promise.all([
    supabase.from('venue_tab_content').select('*').eq('venue_id', venueId),
    supabase.from('venue_media').select('id,url,storage_path,alt_text,media_type')
      .eq('venue_id', venueId).eq('media_type', 'image'),
    supabase.from('venue_setting_prose').select('*').eq('venue_id', venueId).maybeSingle(),
  ]);

  // Passed whole rather than pre-rendered, so the editor previews the
  // same component the listing will use.

  // Signed URLs so the image pickers can show thumbnails from the private
  // bucket rather than broken images.
  const paths = (media ?? []).map((m: any) => m.storage_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage
      .from('venue-media').createSignedUrls(paths, 3600);
    (urls ?? []).forEach((u: any) => { if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl); });
  }

  const images = (media ?? []).map((m: any) => ({
    id: m.id,
    url: m.url,
    display_url: m.storage_path ? signed.get(m.storage_path) ?? null : m.url,
    alt_text: m.alt_text,
  }));

  const tabs = tabsFor(venue.venue_category ?? []);
  const byKey = new Map((content ?? []).map((c: any) => [c.tab_key, c]));

  return (
    <TabContentEditor
      venueId={venueId}
      tabs={tabs}
      content={tabs.map((t) => ({ tab: t, row: byKey.get(t.key) ?? null }))}
      images={images}
    />
  );
}
