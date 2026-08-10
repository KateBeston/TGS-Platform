'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { deviceFrom } from '@/lib/deviceFrom';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; token?: string } | { ok: false; error: string };

const tidy = (m: string) => m.replace(/^.*?ERROR:\s*/, '').trim();

/** Records a sign-in, a sign-out, or a failure.
 *
 *  Failures are recorded against the address even where no account
 *  exists — somebody trying an address that is not registered is the
 *  interesting case, and dropping it because there is no user row loses
 *  exactly the events worth seeing. */
export async function recordAccess(
  event: 'Signed in' | 'Signed out' | 'Failed' | 'Password reset'
       | 'Password changed' | 'Timed out' | 'Session ended',
  email: string,
  sessionId?: string,
  failureReason?: string,
) {
  const supabase = await createClient();
  const h = await headers();

  const ua = h.get('user-agent');
  // Vercel puts the real address in x-forwarded-for; the first entry is
  // the client and the rest are proxies.
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim()
    || h.get('x-real-ip') || null;

  const { data: user } = await supabase
    .from('app_users').select('id').ilike('email', email.trim()).maybeSingle();

  await supabase.from('login_events').insert({
    app_user_id: user?.id ?? null,
    email: email.trim().toLowerCase(),
    event,
    failure_reason: failureReason ?? null,
    ip_address: ip,
    user_agent: ua,
    device: deviceFrom(ua),
    session_id: sessionId ?? null,
  });
}

export async function accessHistory(appUserId?: number, limit = 100) {
  const supabase = await createClient();
  let q = supabase.from('access_history')
    .select('*').order('occurred_at', { ascending: false }).limit(limit);
  if (appUserId) q = q.eq('app_user_id', appUserId);
  const { data } = await q;
  return data ?? [];
}

/** Failed attempts, grouped. One is a typo; six against one address in a
 *  minute is somebody trying. */
export async function failedAttempts(hours = 168) {
  const supabase = await createClient();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data } = await supabase.from('login_events')
    .select('email,ip_address,occurred_at,failure_reason,device')
    .eq('event', 'Failed').gte('occurred_at', since)
    .order('occurred_at', { ascending: false }).limit(200);
  return data ?? [];
}

/* ── invitations ─────────────────────────────────────────────────── */

export async function invitations() {
  const supabase = await createClient();
  const { data } = await supabase.from('user_invitations')
    .select('*, role_definitions(name,rank)')
    .order('created_at', { ascending: false }).limit(50);
  return data ?? [];
}

export async function invitePerson(
  email: string, role: string, firstName?: string, surname?: string,
  message?: string, origin?: string
): Promise<Result> {
  const supabase = await createClient();
  const h = await headers();
  const { data, error } = await supabase.rpc('invite_person', {
    p_email: email.trim(),
    p_role: role,
    p_first_name: firstName?.trim() || null,
    p_surname: surname?.trim() || null,
    p_message: message?.trim() || null,
  });
  if (error) return { ok: false, error: tidy(error.message) };

  revalidatePath('/settings/users');

  // Emailed where possible. The link is still shown either way — if
  // Postmark is down, copying it by hand should not be blocked by the
  // thing meant to save that effort.
  //
  // The address is worked out here rather than relied on from the
  // caller. Passing it was optional, so forgetting to pass it skipped
  // the email in silence — which looks exactly like Postmark failing and
  // leaves nothing in the send log to say otherwise.
  const requestOrigin = origin ?? (() => {
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('host');
    return host ? `${proto}://${host}` : null;
  })();

  let sent = false;
  let sendError: string | null = null;

  if (requestOrigin && (data as any)?.id) {
    const { emailInvitation, notifyAccountChange } = await import('./notify');
    const r = await emailInvitation((data as any).id, requestOrigin);
    sent = r.ok;
    if (!r.ok) sendError = (r as any).error;

    await notifyAccountChange(
      'Somebody was invited',
      `${email} was invited as ${role}${sent ? ' and emailed the link' : ''}.`);
  }

  return {
    ok: true,
    token: (data as any)?.token,
    message: sent
      ? `Invitation emailed to ${email}. It lasts seven days.`
      : sendError
        ? `Invitation created but the email failed: ${sendError}. Send the link by hand.`
        : 'Invitation created. Send them the link — it lasts seven days.',
  };
}

export async function withdrawInvitation(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('user_invitations')
    .update({ status: 'Withdrawn' }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/users');
  return { ok: true, message: 'Withdrawn. The link no longer works.' };
}
