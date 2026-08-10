import Link from 'next/link';
import { notFound } from 'next/navigation';
import { draftChanges } from '@/app/actions/venueIntake';
import { createClient } from '@/lib/supabase/server';
import RereadReview from '@/components/RereadReview';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export default async function RereadPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name,website_url,logo_url,last_intake_at,last_intake_draft_id')
    .eq('id', venueId).single();
  if (!venue) notFound();

  const draftId = Number(sp.draft ?? venue.last_intake_draft_id ?? 0);

  const [{ data: draft }, changes, { data: history }] = await Promise.all([
    draftId
      ? supabase.from('venue_intake_drafts').select('*').eq('id', draftId).maybeSingle()
      : Promise.resolve({ data: null }),
    draftId ? draftChanges(draftId) : Promise.resolve([]),
    supabase.from('venue_intake_drafts')
      .select('id,created_at,status,cost_usd,run_kind,pages_read,pages_failed,'
              + 'error_message,logo_url,unchanged_pages,changed_pages,'
              + 'input_tokens,output_tokens')
      .eq('refreshes_venue_id', venueId)
      .order('created_at', { ascending: false }).limit(10),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href={`/venues/${venueId}/details`}>{venue.venue_name}</Link> · Site reads
      </div>
      <RereadReview
        venue={venue}
        draft={draft ?? null}
        changes={changes}
        history={history ?? []}
      />
    </div></div>
  );
}
