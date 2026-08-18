'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/app/actions/auth';

/* The account drawer — a right-side slide-in that opens from the account
 * control in the header. Carries a Sanctum Société membership card (which
 * grows a tier and points once that layer is built) and icon-led account
 * navigation. Loads the profile once and exposes it so the header can show
 * the member's name and avatar without a second load. */

type Profile = {
  first_name?: string | null; surname?: string | null;
  email?: string | null; created_at?: string | null;
} | null;
type Ctx = { open: () => void; close: () => void; isOpen: boolean; signedIn: boolean; profile: Profile };
const AccCtx = createContext<Ctx | null>(null);
export function useAccountDrawer() { return useContext(AccCtx); }

/* Minimal line icons (Feather-style), stroked with currentColor. */
const ICON: Record<string, ReactNode> = {
  heart: <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z" />,
  bag: <><path d="M4 8h16l-1 12H5L4 8z" /><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" /></>,
  bookmark: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />,
  user: <><path d="M20 21v-1.5a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5V21" /><circle cx="12" cy="7" r="4" /></>,
  leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" /><path d="M2 21c0-3 1.9-5.4 5.1-6" /></>,
  mail: <><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M3.5 6.5 12 13l8.5-6.5" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="1.5" /><path d="M2.5 9.5h19" /></>,
  gift: <><path d="M20 12v9H4v-9" /><path d="M2.5 7.5h19V12h-19z" /><path d="M12 21V7.5" /><path d="M12 7.5H7.8a2.3 2.3 0 0 1 0-4.5C10.8 3 12 7.5 12 7.5z" /><path d="M12 7.5h4.2a2.3 2.3 0 0 0 0-4.5C13.2 3 12 7.5 12 7.5z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
};
function Icon({ name }: { name: string }) {
  return (
    <svg className="acc-ico" viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[name]}
    </svg>
  );
}

type Item = { icon: string; label: string; href?: string; soon?: boolean };
const GROUPS: Item[][] = [
  [
    { icon: 'heart', label: 'Saved venues', href: '/account' },
    { icon: 'bag', label: 'My bookings', soon: true },
    { icon: 'bookmark', label: 'Saved plans', soon: true },
  ],
  [
    { icon: 'user', label: 'My profile', href: '/account' },
    { icon: 'leaf', label: 'Wellness & retreat preferences', href: '/account' },
    { icon: 'mail', label: 'Communication preferences', href: '/account' },
    { icon: 'card', label: 'Credits & payment methods', soon: true },
  ],
  [
    { icon: 'gift', label: 'Refer a friend', soon: true },
  ],
];

export function AccountDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile>(null);

  const load = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSignedIn(false); setProfile(null); setIsOpen(false); return; }
    setSignedIn(true);
    const { data } = await supabase.from('profiles').select('first_name,surname,created_at').eq('id', user.id).maybeSingle();
    setProfile({ ...(data ?? {}), email: user.email });
  };

  useEffect(() => {
    load();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const first = profile?.first_name || (profile?.email ? profile.email.split('@')[0] : 'there');
  const fullName = [profile?.first_name, profile?.surname].filter(Boolean).join(' ') || first;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    : null;

  const row = (it: Item) => {
    const inner = (
      <>
        <Icon name={it.icon} />
        <span className="acc-link-label">{it.label}</span>
        {it.soon && <span className="acc-soon">Soon</span>}
      </>
    );
    if (it.soon || !it.href) return <div key={it.label} className="acc-link soon">{inner}</div>;
    return <Link key={it.label} href={it.href} className="acc-link" onClick={close}>{inner}</Link>;
  };

  return (
    <AccCtx.Provider value={{ open, close, isOpen, signedIn, profile }}>
      {children}
      {signedIn && (
        <>
          <div className={`acc-overlay${isOpen ? ' on' : ''}`} onClick={close} aria-hidden="true" />
          <aside className={`acc-drawer${isOpen ? ' on' : ''}`} aria-label="Your account">
            <div className="acc-head">
              <span className="acc-hi">Hi, {first}</span>
              <button type="button" className="acc-close" onClick={close} aria-label="Close">&times;</button>
            </div>

            <div className="acc-body">
              <div className="acc-member">
                <div className="acc-member-top">
                  <img className="acc-member-logo" src="/brand/sanctum-societe.png" alt="Sanctum Societe" />
                  <span className="acc-member-tier">Member</span>
                </div>
                <div className="acc-member-name">{fullName}</div>
                {memberSince && <div className="acc-member-since">Member since {memberSince}</div>}
                <Link href="/account" className="acc-member-link" onClick={close}>
                  View account
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
              </div>

              {GROUPS.map((g, i) => (
                <nav key={i} className="acc-group">{g.map(row)}</nav>
              ))}
            </div>

            <div className="acc-foot">
              <form action={signOut}>
                <button type="submit" className="acc-logout"><Icon name="logout" /> Log out</button>
              </form>
            </div>
          </aside>
        </>
      )}
    </AccCtx.Provider>
  );
}
