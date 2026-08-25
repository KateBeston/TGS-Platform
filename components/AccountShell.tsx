'use client';

import { useActionState, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import PhoneField from '@/components/PhoneField';
import { updateProfile, updateComms, changeEmail, changePassword, setOrientation } from '@/app/actions/account';
import HostProfile from '@/components/HostProfile';
import TwoFactorSetup from '@/components/TwoFactorSetup';
import type { HostData } from '@/app/actions/host';

const VMS_URL = 'https://vms.theglobalsanctum.com';
const TABS = ['Profile', 'Bookings', 'Saved venues', 'Preferences', 'Communications', 'Settings', 'Venue management'] as const;
type Tab = (typeof TABS)[number];

export type Activity = {
  activity_kind: 'attending' | 'hosting'; record_kind: 'enquiry' | 'booking';
  id: number; venue_name: string | null; date_from: string | null; date_to: string | null; status: string | null;
};

type Profile = {
  first_name?: string | null; surname?: string | null; display_name?: string | null;
  phone?: string | null; primary_audience?: string | null; marketing_opt_in?: boolean | null;
  created_at?: string | null;
};

type Country = { id: number; name: string; iso_code: string; dialling_code: string };

export default function AccountShell({
  email, profile, isOwner, isHost, savedNode, activity, hostData, countries, initialTab,
}: { email: string; profile: Profile; isOwner: boolean; isHost: boolean; savedNode: ReactNode; activity: Activity[]; hostData: HostData | null; countries: Country[]; initialTab?: Tab }) {
  const safeInitial = initialTab === 'Venue management' && !isOwner ? 'Profile' : (initialTab ?? 'Profile');
  const [tab, setTab] = useState<Tab>(safeInitial);
  const visibleTabs = TABS.filter((t) => t !== 'Venue management' || isOwner);
  const name = [profile.first_name, profile.surname].filter(Boolean).join(' ') || email;
  const since = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    : null;

  return (
    <main id="main" className="acct">
      <div className="acct-head">
        <div className="acct-eyebrow">Your Account</div>
        <h1 className="acct-name">{name}</h1>
        <p className="acct-meta">{email}{since ? <> &middot; Member since {since}</> : null}</p>
      </div>

      <nav className="acct-tabs">
        {visibleTabs.map((t) => (
          <button key={t} className={`acct-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {tab === 'Profile' && <ProfilePanel profile={profile} email={email} countries={countries} />}
      {tab === 'Bookings' && <BookingsPanel activity={activity} />}
      {tab === 'Saved venues' && <SavedPanel savedNode={savedNode} />}
      {tab === 'Preferences' && <PreferencesPanel profile={profile} isHost={isHost} hostData={hostData} />}
      {tab === 'Communications' && <CommsPanel profile={profile} />}
      {tab === 'Settings' && <SettingsPanel email={email} />}
      {tab === 'Venue management' && isOwner && <VenuePanel isOwner={isOwner} />}

      <form action={signOut} className="acct-signout">
        <button type="submit" className="acct-ghost-btn">Sign out</button>
      </form>
    </main>
  );
}

function Saved({ ok }: { ok?: boolean }) {
  if (!ok) return null;
  return <p className="acct-saved-note">Saved.</p>;
}

function ProfilePanel({ profile, email, countries }: { profile: Profile; email: string; countries: Country[] }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <section className="acct-panel">
      <h2 className="acct-panel-title">Your details</h2>
      <form action={action} className="acct-form">
        <div className="acct-row2">
          <label className="acct-f"><span>First name</span>
            <input name="first_name" defaultValue={profile.first_name ?? ''} /></label>
          <label className="acct-f"><span>Surname</span>
            <input name="surname" defaultValue={profile.surname ?? ''} /></label>
        </div>
        <label className="acct-f"><span>Display name</span>
          <input name="display_name" defaultValue={profile.display_name ?? ''} />
          <small>How you&rsquo;d like to be addressed, if different.</small></label>
        <label className="acct-f"><span>Phone</span>
          <PhoneField countries={countries} value={profile.phone ?? ''} name="phone" defaultIso="AU" /></label>
        <label className="acct-f"><span>Email</span>
          <input value={email} disabled />
          <small>Your email is the login for your Global Sanctum account and can&rsquo;t be changed here.</small></label>
        {state?.error && <p className="acct-err">{state.error}</p>}
        <div className="acct-actions"><button className="acct-btn" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button><Saved ok={state?.ok} /></div>
      </form>
    </section>
  );
}

function fmtDates(a: string | null, b: string | null) {
  if (!a) return null;
  const d = (x: string) => new Date(x).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  return b && b !== a ? `${d(a)} – ${d(b)}` : d(a);
}

function BookingsPanel({ activity }: { activity: Activity[] }) {
  const attending = activity.filter((a) => a.activity_kind === 'attending');
  const hosting = activity.filter((a) => a.activity_kind === 'hosting');

  const Group = ({ title, note, items }: { title: string; note: string; items: Activity[] }) => (
    <div className="acct-book-group">
      <h3 className="acct-book-h">{title}</h3>
      {items.length === 0 ? (
        <p className="acct-book-empty">{note}</p>
      ) : (
        <ul className="acct-book-list">
          {items.map((a) => (
            <li key={`${a.record_kind}-${a.id}`} className="acct-book-item">
              <div className="acct-book-main">
                <span className="acct-book-venue">{a.venue_name ?? 'Venue to be confirmed'}</span>
                <span className={`acct-book-tag ${a.record_kind}`}>{a.record_kind === 'booking' ? 'Booked' : 'Enquiry'}</span>
              </div>
              <div className="acct-book-meta">
                {fmtDates(a.date_from, a.date_to) ?? 'Dates flexible'}{a.status ? ` · ${a.status}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="acct-panel">
      <h2 className="acct-panel-title">Bookings</h2>
      <p className="acct-panel-sub">Retreats you&rsquo;re attending and venues you&rsquo;re sourcing to host — all in one place.</p>
      <Group title="Attending" note="No retreats yet. When you book or enquire about a retreat to attend, it&rsquo;ll appear here." items={attending} />
      <Group title="Hosting" note="Nothing yet. When you enquire about a venue to host your own retreat, it&rsquo;ll appear here." items={hosting} />
    </section>
  );
}

function SavedPanel({ savedNode }: { savedNode: ReactNode }) {
  return (
    <section className="acct-panel">
      <h2 className="acct-panel-title">Saved venues</h2>
      {savedNode ?? (
        <div className="acct-empty">
          <p>You haven&rsquo;t saved any venues yet.</p>
          <Link href="/venues" className="acct-btn">Explore venues</Link>
        </div>
      )}
    </section>
  );
}

function PreferencesPanel({ profile, isHost, hostData }: { profile: Profile; isHost: boolean; hostData: HostData | null }) {
  const audience = profile.primary_audience === 'host' ? 'host' : 'guest';
  const Opt = ({ kind, title, desc }: { kind: 'guest' | 'host'; title: string; desc: string }) => {
    const current = audience === kind;
    return (
      <form action={setOrientation} className="acct-orient-form">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="redirect_to" value="/account?tab=preferences" />
        <button type="submit" className={`acct-orient-opt${current ? ' on' : ''}`} disabled={current}>
          <span className="acct-orient-text"><strong>{title}</strong><em>{desc}</em></span>
          <span className="acct-orient-cur">{current ? 'Current' : 'Switch'}</span>
        </button>
      </form>
    );
  };
  return (
    <section className="acct-panel">
      <h2 className="acct-panel-title">Preferences</h2>
      <p className="acct-panel-sub">
        You&rsquo;re exploring The Global Sanctum as a <strong>{audience === 'host' ? 'retreat host' : 'wellness guest'}</strong>.
        This shapes what we lead with — you can switch anytime, and you&rsquo;re free to explore both.
      </p>
      <div className="acct-orient">
        <Opt kind="guest" title="Wellness guest" desc="Looking for wellness experiences and spaces to visit." />
        <Opt kind="host" title="Retreat host" desc="Looking for a venue to host my own retreat." />
      </div>
      {isHost && hostData && (
        <div className="host-profile-wrap">
          <h2 className="acct-panel-title" style={{ marginTop: 40 }}>Your host profile</h2>
          <p className="acct-panel-sub">Your practice and what you look for in a venue. This is yours as a retreat host — it shapes your venue matches and helps us understand our host community.</p>
          <HostProfile data={hostData} />
        </div>
      )}
    </section>
  );
}

function CommsPanel({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateComms, null);
  return (
    <section className="acct-panel">
      <h2 className="acct-panel-title">Communication preferences</h2>
      <form action={action} className="acct-form">
        <label className="acct-check">
          <input type="checkbox" name="marketing_opt_in" defaultChecked={!!profile.marketing_opt_in} />
          <span><strong>News, offers &amp; new venues</strong><em>Occasional updates when something worth your time arrives — new sanctuaries, exclusive rates, and seasonal openings.</em></span>
        </label>
        <p className="acct-panel-sub">The Sanctum Journal, our monthly publication, is a separate subscription you can manage from any issue.</p>
        {state?.error && <p className="acct-err">{state.error}</p>}
        <div className="acct-actions"><button className="acct-btn" disabled={pending}>{pending ? 'Saving…' : 'Save preferences'}</button><Saved ok={state?.ok} /></div>
      </form>
    </section>
  );
}

function SettingsPanel({ email }: { email: string }) {
  const [emState, emAction, emPending] = useActionState(changeEmail, null);
  const [pwState, pwAction, pwPending] = useActionState(changePassword, null);
  return (
    <section className="acct-panel">
      <h2 className="acct-panel-title">Settings &amp; security</h2>
      <form action={emAction} className="acct-form">
        <label className="acct-f"><span>Current login email</span><input value={email} disabled /></label>
        <label className="acct-f"><span>New login email</span>
          <input name="new_email" type="email" placeholder="you@example.com" />
          <small>We&rsquo;ll send a confirmation link to the new address. Your login only changes once you confirm it.</small></label>
        {emState?.error && <p className="acct-err">{emState.error}</p>}
        {emState?.message && <p className="acct-msg">{emState.message}</p>}
        <div className="acct-actions"><button className="acct-btn" disabled={emPending}>{emPending ? 'Sending…' : 'Change email'}</button></div>
      </form>
      <form action={pwAction} className="acct-form" style={{ marginTop: 28 }}>
        <label className="acct-f"><span>New password</span>
          <input name="new_password" type="password" autoComplete="new-password" />
          <small>At least 8 characters.</small></label>
        <label className="acct-f"><span>Confirm new password</span>
          <input name="confirm_password" type="password" autoComplete="new-password" /></label>
        {pwState?.error && <p className="acct-err">{pwState.error}</p>}
        {pwState?.message && <p className="acct-msg">{pwState.message}</p>}
        <div className="acct-actions"><button className="acct-btn" disabled={pwPending}>{pwPending ? 'Updating…' : 'Change password'}</button></div>
      </form>
      <div className="acct-2fa-sec">
        <h3 className="acct-sec-h">Two-factor authentication</h3>
        <TwoFactorSetup />
      </div>
    </section>
  );
}

function VenuePanel({ isOwner }: { isOwner: boolean }) {
  return (
    <section className="acct-panel">
      <div className="acct-vms">
        <div className="acct-vms-eyebrow">The Global Sanctum</div>
        <img src="/brand/lockups/sanctum-vms.png" alt="Sanctum VMS" className="acct-vms-mark" />
        <p className="acct-vms-desc">Venue Management &mdash; a service of The Global Sanctum</p>
        {isOwner ? (
          <>
            <p className="acct-vms-body">You&rsquo;re a venue partner. Manage your listings, subscription and venue details in your management portal.</p>
            <a href={VMS_URL} className="acct-btn" target="_blank" rel="noopener">Open Sanctum VMS &rarr;</a>
          </>
        ) : (
          <>
            <p className="acct-vms-body">Have a venue to list? Join The Global Sanctum as a venue partner and reach a global wellness audience. Sign in with your Global Sanctum account &mdash; we&rsquo;ll add venue management to it.</p>
            <a href={`${VMS_URL}/sign-up`} className="acct-btn" target="_blank" rel="noopener">List your venue &rarr;</a>
          </>
        )}
      </div>
    </section>
  );
}
