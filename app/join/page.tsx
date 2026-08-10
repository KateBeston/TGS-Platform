import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AcceptInvitation from '@/components/AcceptInvitation';

export const dynamic = 'force-dynamic';

/** Accepting an invitation. There is no sign-up page — an internal portal
 *  with self-service registration means anybody who finds the URL can
 *  create an account and wait to be noticed. */
export default async function JoinPage({
  searchParams,
}: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  if (!sp.token) notFound();

  const supabase = await createClient();
  const { data: invite } = await supabase
    .from('user_invitations')
    .select('*, role_definitions(name,description)')
    .eq('token', sp.token)
    .maybeSingle();

  const state =
    !invite ? 'unknown'
    : invite.status === 'Accepted' ? 'used'
    : invite.status === 'Withdrawn' ? 'withdrawn'
    : new Date(invite.expires_at) < new Date() ? 'expired'
    : 'valid';

  return <AcceptInvitation invite={invite} state={state} token={sp.token} />;
}
