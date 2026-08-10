import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { practiceOptions } from '@/app/actions/venueIntake';
import AddVenue from '@/components/AddVenue';

export const dynamic = 'force-dynamic';

export default async function NewVenuePage({
  searchParams,
}: { searchParams: Promise<{ draft?: string; group?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: draft }, { data: recent }, practices, { data: categories }] =
    await Promise.all([
    sp.draft
      ? supabase.from('venue_intake_drafts').select('*').eq('id', Number(sp.draft)).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('venue_intake_drafts').select('*')
      .in('status', ['Ready', 'Failed'])
      .order('created_at', { ascending: false }).limit(8),
    practiceOptions(),
    supabase.from('modality_categories').select('id,name').order('display_order'),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> · Add a venue
      </div>
      <AddVenue draft={draft ?? null} recent={recent ?? []} group={sp.group ?? null}
                practices={practices} categories={categories ?? []} />
    </div></div>
  );
}
