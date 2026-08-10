import Link from 'next/link';
import { notFound } from 'next/navigation';
import { archiveReasons, deleteImpact, similarTo } from '@/app/actions/venues';
import { createClient } from '@/lib/supabase/server';
import VenueArchive from '@/components/VenueArchive';

export const dynamic = 'force-dynamic';

export default async function VenueArchivePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('id,venue_name,archived_at,archived_reason,archived_by,archive_reason_id,'
      + 'website_url,venue_status')
    .eq('id', venueId).single();
  if (!venue) notFound();

  const [reasons, impact, similar, { data: history }] = await Promise.all([
    archiveReasons(),
    deleteImpact(venueId),
    similarTo(venueId),
    supabase.from('audit_log')
      .select('operation,reason,changed_by,changed_at')
      .eq('table_name', 'venues').eq('record_id', venueId)
      .in('operation', ['ARCHIVE', 'RESTORE', 'MERGE'])
      .order('changed_at', { ascending: false }).limit(10),
  ]);

  return (
    <VenueArchive
      venue={venue}
      reasons={reasons}
      impact={impact}
      similar={similar}
      history={history ?? []}
    />
  );
}
