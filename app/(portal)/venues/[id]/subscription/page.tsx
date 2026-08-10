import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SubscriptionEditor from '@/components/SubscriptionEditor';
import TierChange from '@/components/TierChange';

export const dynamic = 'force-dynamic';

export default async function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('id,venue_name').eq('id', venueId).single();
  if (!venue) notFound();

  const [{ data: subs }, { data: tiers }, { data: programs }, { count: listings }] =
    await Promise.all([
      supabase.from('venue_subscriptions').select('*')
        .eq('venue_id', venueId).order('started_at', { ascending: false }),
      supabase.from('subscription_tiers').select('*').eq('is_active', true).order('display_order'),
      supabase.from('partner_programs').select('*').eq('is_active', true).order('display_order'),
      supabase.from('venue_listings').select('*', { count: 'exact', head: true })
        .eq('venue_id', venueId),
    ]);

  const current = (subs ?? []).find((s: any) => s.status === 'Active') ?? null;

  // A downgrade that has not happened yet. Shown so the tab can say
  // "Standard from 18 August" rather than a tier that is about to change.
  const { data: pending } = current?.pending_change_id
    ? await supabase.from('subscription_changes')
        .select('*, to_tier:to_tier_id(name)')
        .eq('id', current.pending_change_id).maybeSingle()
    : { data: null };

  return (
    <>
      <SubscriptionEditor
        venueId={venueId}
        subscriptions={subs ?? []}
        tiers={tiers ?? []}
        programs={programs ?? []}
        listingCount={listings ?? 0}
      />
      <TierChange venueId={venueId} tiers={tiers ?? []}
                  current={current} pending={pending} />
    </>
  );
}
