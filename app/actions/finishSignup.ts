'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { notify, report } from '@/lib/notify';

/* ═══════════════════════════════════════════════════════════════════════
   THE FAR SIDE OF THE CONFIRMATION LINK

   The sign-up form takes no password, so everything that makes an account
   happens here, once the link has proven the mailbox belongs to them.

   Two shapes, and the difference is invisible unless you are looking for
   it:

     an address with no password yet   chooses one here
     an address that already has one   does not, and theirs is untouched

   The second case is a venue owner who signed up to Sanctum VMS at some
   point. Supabase keeps one password per address, so writing a new one
   would replace the password that opens their VMS — they would find out
   days later, locked out, with nothing connecting the two events. The
   products are separate and the password store underneath is not, so the
   only safe answer is to leave an existing password alone. They are
   signed in by the link either way, and nothing on screen mentions the
   VMS or an account elsewhere.
   ═══════════════════════════════════════════════════════════════════════ */

type State = { error?: string; ok?: boolean } | null;

const PENDING = 'tgs_pending_signup';

type Answers = {
  first_name?: string; surname?: string;
  primary_audience?: string; marketing_opt_in?: boolean;
};

/** The answers from the sign-up form, carried across the email.
 *
 *  Supabase applies `options.data` only when it creates a row, so for an
 *  address it had already seen the answers arrive only in this cookie. */
async function pendingAnswers(): Promise<Answers> {
  const jar = await cookies();
  const raw = jar.get(PENDING)?.value;
  if (!raw) return {};
  try { return JSON.parse(raw) as Answers; } catch { return {}; }
}

/** Does this account still need a password? Read on the server so the
 *  answer cannot be spoofed by the page that asks. */
export async function needsPassword(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc('account_has_password');
  /* If the question cannot be answered, offer the step. Asking for a
     password that turns out to be unnecessary is a wasted field; skipping
     one that was necessary leaves an account nobody can sign in to. */
  if (error) return true;
  return data === false;
}

export type SignupShape = {
  needsPassword: boolean;
  /* Reopening an account they closed, rather than opening a new one. */
  reinstating: boolean;
  firstName: string | null;
  closedAt: string | null;
};

/** Which of the three shapes this last step takes, decided on the server.
 *
 *  needsPassword      an address with no password chooses one
 *  reinstating        an account that was closed, offered back, with the
 *                     password optional if there is already one
 *  neither            signed in by the link, nothing left to ask
 *
 *  The closure is read from the archive row rather than from a cookie, so
 *  it is the database that decides whether an account is being reopened.
 *  Row security confines the read to this person's own address. */
export async function signupShape(): Promise<SignupShape> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { needsPassword: false, reinstating: false, firstName: null, closedAt: null };

  const needs = await needsPassword();

  const { data: row } = await supabase.from('account_archive')
    .select('first_name, archived_at')
    .eq('outcome', 'Closed')
    .is('returned_at', null)
    .order('archived_at', { ascending: false })
    .limit(1).maybeSingle();

  return {
    needsPassword: needs,
    reinstating: !!row,
    firstName: ((row as any)?.first_name as string) ?? null,
    closedAt: ((row as any)?.archived_at as string) ?? null,
  };
}

/* Everything after the password decision, shared by both shapes. */
async function openAccount(password: string | null): Promise<State> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'That link has expired. Start the sign-up again and we will send a fresh one.' };
  }

  const a = await pendingAnswers();
  const audience = a.primary_audience ?? String(user.user_metadata?.primary_audience ?? 'guest');
  const marketing = a.marketing_opt_in ?? !!user.user_metadata?.marketing_opt_in;
  const first = (a.first_name ?? String(user.user_metadata?.first_name ?? '')).trim();
  const surname = (a.surname ?? String(user.user_metadata?.surname ?? '')).trim();

  /* The metadata first, because ensure_platform_profile builds the profile
     and the contact role from it. Password only when there is one to set:
     passing it for an account that already has one is the overwrite this
     whole shape exists to avoid. */
  const { error } = await supabase.auth.updateUser({
    ...(password ? { password } : {}),
    data: { first_name: first, surname, primary_audience: audience, marketing_opt_in: marketing },
  });
  if (error) return { error: error.message };

  (await cookies()).delete(PENDING);

  /* Profile, platform role and contact link, from the metadata just
     written. The venue side is untouched: this opens a marketplace
     account, it does not convert anything.

     open_platform_account, not ensure_platform_profile. This is the one
     place a marketplace account is created, and it is the only caller
     allowed to create one for an address registered with Sanctum VMS —
     because here they have asked for it. ensure_platform_profile now
     refuses that case, which is what stops signing in, confirming a link
     or opening /account from quietly manufacturing an account for a venue
     owner and putting a closed one straight back. */
  await supabase.rpc('open_platform_account');

  /* The audience is applied after, because ensure_platform_profile inserts
     the profile and leaves an existing row alone — and for an address that
     had been here before, a row may already exist carrying the default. */
  await supabase.from('profiles').update({
    primary_audience: audience === 'host' ? 'host' : 'guest',
    marketing_opt_in: marketing,
    ...(first ? { first_name: first } : {}),
    ...(surname ? { surname } : {}),
  }).eq('id', user.id);

  /* Coming back, and the record saying so.
   *
   * Called after the profile and the contact link exist, because the
   * function restores the roles they held when they closed it and needs
   * the contact to restore them to. It stamps returned_at on the archive
   * row rather than removing it, so the history reads "closed on the 15th,
   * reinstated on the 20th" — both events, not the latest one.
   *
   * No-op for anybody who has not closed an account, so it is called
   * unconditionally rather than behind a flag the page could get wrong. */
  const { data: back } = await supabase.rpc('reinstate_marketplace_account');
  const reinstated = !!(back as any)?.reinstated;

  /* What they agreed to, recorded.
   *
   * The sign-up form says "by continuing you agree to our Terms and
   * Privacy Policy", and until now that was the whole of it: a sentence
   * shown, nothing kept. This writes a row per document with the version,
   * the SHA-256 of the exact body, the IP and the user agent — the same
   * evidence the venue application has always captured, and the only thing
   * that answers "which wording did they accept" a year later.
   *
   * Recorded here rather than on the form, because this is the first
   * moment the address is known to belong to them. The document list lives
   * in the function, so the User Account Agreement starts being recorded
   * the day it is published without anything shipping. */
  const h = await headers();
  await supabase.rpc('record_signup_agreements', {
    p_ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
    p_user_agent: h.get('user-agent') ?? null,
  });

  /* The welcome, and the portal told a new account exists. Both fire and
     forget: the account is open either way, and somebody who has just
     finished signing up should not be shown an error because a
     notification could not be delivered. */
  const full = [first, surname].filter(Boolean).join(' ');
  const origin = h.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';

  /* Two lines, not three. The third answered somebody who had chosen
     "Venue owner" on the sign-up form by offering to take them through
     listing a venue — a welcome to a marketplace account that pointed at
     the venue funnel instead. That option is gone from the form, and an
     older account whose metadata still says 'owner' is welcomed as what
     their marketplace account actually makes them. */
  const audienceLine = audience === 'host'
    ? 'You told us you are here mainly to host retreats, so we will point you at venues that take them and the people who run them.'
    : 'You told us you are here mainly for wellness experiences, so we will keep you to places and practitioners worth the trip.';

  notify({
    slug: 'account-welcome',
    to: String(user.email ?? ''),
    extra: {
      first_name: first || 'there',
      audience_line: audienceLine,
      account_url: `${origin.replace(/\/$/, '')}/account`,
    },
  });

  const asA = audience === 'host' ? 'retreat host' : 'wellness guest';

  report(reinstated
    ? {
        event: 'user.reinstated',
        title: 'A member reopened their account',
        body: `${full || String(user.email ?? 'Someone')} came back to an account they`
          + ` had closed, and reopened it as a ${asA}.`,
        url: '/contacts',
      }
    : {
        event: 'user.created',
        title: 'A new user account',
        body: `${full || String(user.email ?? 'Someone')} confirmed their email as a ${asA}.`,
        url: '/contacts',
      });

  return { ok: true };
}

/** With a password — required for an account that has none, optional for
 *  one being reopened.
 *
 *  The server decides which, not the form. A password posted for an
 *  account that already has one is normally the overwrite this whole
 *  shape exists to avoid, and is dropped. The single exception is
 *  reinstatement: somebody deliberately reopening their own account and
 *  choosing a new password has asked for exactly that, on their own
 *  login, in the one place where it is their decision to make. */
export async function finishSignup(_prev: State, formData: FormData): Promise<State> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');
  const shape = await signupShape();

  const wants = password.length > 0;
  const must = shape.needsPassword;

  if (must && !wants) return { error: 'Please choose a password.' };
  if (wants) {
    if (password.length < 8) return { error: 'Please use at least 8 characters for your password.' };
    if (password !== confirm) return { error: 'The two passwords don’t match.' };
  }

  const write = wants && (must || shape.reinstating);
  return openAccount(write ? password : null);
}

/** Without one, for an account that already has a password. */
export async function finishSignupNoPassword(_prev: State): Promise<State> {
  return openAccount(null);
}
