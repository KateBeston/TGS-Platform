'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import VenueGrid from '@/components/VenueGrid';
import { signOut } from '@/app/actions/auth';
import { updateProfile, updatePreferences, updateComms } from '@/app/actions/account';
import type { Card } from '@/lib/venues';

const VMS_URL = 'https://vms.theglobalsanctum.com';
const TABS = ['Profile', 'Saved venues', 'Preferences', 'Communications', 'Venue management'] as const;
type Tab = (typeof TABS)[number];

type Profile = {
  first_name?: string | null; surname?: string | null; display_name?: string | null;
  phone?: string | null; primary_audience?: string | null; marketing_opt_in?: boolean | null;
  created_at?: string | null;
};

export default function AccountShell({
  email, profile, isOwner, savedCards, initialTab,
}: { email: string; profile: Profile; isOwner: boolean; savedCards: Card[]; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'Profile');
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
        {TABS.map((t) => (
          <button key={t} className={`acct-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {tab === 'Profile' && <ProfilePanel profile={profile} email={email} />}
      {tab === 'Saved venues' && <SavedPanel cards={savedCards} />}
      {tab === 'Preferences' && <PreferencesPanel profile={profile} />}
      {tab === 'Communications' && <CommsPanel profile={profile} />}
      {tab === 'Venue management' && <VenuePanel isOwner={isOwner} />}

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

function ProfilePanel({ profile, email }: { profile: Profile; email: string }) {
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
          <input name="phone" type="tel" defaultValue={profile.phone ?? ''} /></label>
        <label className="acct-f"><span>Email</span>
          <input value={email} disabled />
          <small>Your email is the login for your Global Sanctum account and can&rsquo;t be changed here.</small></label>
        {state?.error && <p className="acct-err">{state.error}</p>}
        <div className="acct-actions"><button className="acct-btn" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button><Saved ok={state?.ok} /></div>
      </form>
    </section>
  );
}

function SavedPanel({ cards }: { cards: Card[] }) {
  return (
    <section className="acct-panel">
      <h2 className="acct-panel-title">Saved venues</h2>
      {cards.length ? (
        <VenueGrid cards={cards} labels={false} />
      ) : (
        <div className="acct-empty">
          <p>You haven&rsquo;t saved any venues yet.</p>
          <Link href="/venues" className="acct-btn">Explore venues</Link>
        </div>
      )}
    </section>
  );
}

function PreferencesPanel({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updatePreferences, null);
  const audience = profile.primary_audience === 'host' ? 'host' : 'guest';
  return (
    <section className="acct-panel">
      <h2 className="acct-panel-title">Wellness &amp; retreat preferences</h2>
      <p className="acct-panel-sub">This shapes what we bring to the top of your experience.</p>
      <form action={action} className="acct-form">
        <fieldset className="acct-choice">
          <label className="acct-choice-opt">
            <input type="radio" name="primary_audience" value="guest" defaultChecked={audience === 'guest'} />
            <span><strong>Wellness guest</strong><em>I&rsquo;m looking for retreats and wellness experiences to attend.</em></span>
          </label>
          <label className="acct-choice-opt">
            <input type="radio" name="primary_audience" value="host" defaultChecked={audience === 'host'} />
            <span><strong>Retreat host</strong><em>I&rsquo;m searching for venues to host my own retreats.</em></span>
          </label>
        </fieldset>
        {state?.error && <p className="acct-err">{state.error}</p>}
        <div className="acct-actions"><button className="acct-btn" disabled={pending}>{pending ? 'Saving…' : 'Save preferences'}</button><Saved ok={state?.ok} /></div>
      </form>
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
