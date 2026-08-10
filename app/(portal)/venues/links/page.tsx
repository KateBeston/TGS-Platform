import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import LinkPass from '@/components/LinkPass';

export const dynamic = 'force-dynamic';
// Forty sites read six at a time. Slow ones dominate, not the count.
export const maxDuration = 120;

export default async function LinksPage() {
  const supabase = await createClient();

  const [{ data: state }, { data: recent }] = await Promise.all([
    supabase.from('link_pass_state').select('*').maybeSingle(),
    supabase.from('venues')
      .select('id,venue_name,website_url,links_found,links_checked_at,'
        + 'instagram_url,facebook_url,youtube_url,tripadvisor_url,whatsapp_number,other_links')
      .not('links_checked_at', 'is', null)
      .order('links_checked_at', { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> · Links
      </div>
      <LinkPass state={state ?? {}} recent={recent ?? []} />
    </div></div>
  );
}
