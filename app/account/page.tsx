import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AccountShell from '@/components/AccountShell';
import VenueGrid from '@/components/VenueGrid';
import type { Card } from '@/lib/venues';
import type { Activity } from '@/components/AccountShell';

export const metadata = { title: 'Your account — The Global Sanctum' };

const TAB_MAP: Record<string, string> = {
  profile: 'Profile', bookings: 'Bookings', saved: 'Saved venues', preferences: 'Preferences',
  communications: 'Communications', settings: 'Settings', venue: 'Venue management',
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  // Safety net: an owner-first person reaching /account gets a profile created
  // lazily so the page never renders profile-less (no-op if it exists).
  await supabase.rpc('ensure_platform_profile');

  const sp = await searchParams;
  const initialTab = (TAB_MAP[sp?.tab ?? ''] ?? 'Profile') as
    'Profile' | 'Bookings' | 'Saved venues' | 'Preferences' | 'Communications' | 'Settings' | 'Venue management';

  const [{ data: profile }, { data: roles }, { data: savedRows }, { data: activity }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('account_roles').select('role').eq('user_id', user.id),
    supabase.from('profile_saved_venues').select('venue_id').eq('user_id', user.id),
    supabase.rpc('get_my_platform_activity'),
  ]);

  const savedIds = (savedRows ?? []).map((r: { venue_id: number }) => r.venue_id);
  let savedCards: Card[] = [];
  if (savedIds.length) {
    const { data } = await supabase.from('venue_cards').select('*').in('id', savedIds);
    savedCards = (data ?? []) as Card[];
  }
  const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));

  const savedNode = savedCards.length
    ? <VenueGrid cards={savedCards} labels={false} />
    : null;

  return (
    <AccountShell
      email={user.email ?? ''}
      profile={profile ?? {}}
      isOwner={roleSet.has('venue_owner')}
      savedNode={savedNode}
      activity={activity ?? []}
      initialTab={initialTab}
    />
  );
}
