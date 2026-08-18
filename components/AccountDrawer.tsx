'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/app/actions/auth';

/* The account drawer.
 *
 * A right-side slide-in that opens from the account control in the header,
 * the way a member's account panel does on the big marketplaces. It carries
 * who they are, a Sanctum Society card (which grows a tier and points once
 * that layer is built), and their account navigation. Loads the profile
 * once and exposes it, so the header can show the member's name and avatar
 * without loading it a second time. */

type Profile = { first_name?: string | null; surname?: string | null; email?: string | null } | null;
type Ctx = { open: () => void; close: () => void; isOpen: boolean; signedIn: boolean; profile: Profile };
const AccCtx = createContext<Ctx | null>(null);
export function useAccountDrawer() { return useContext(AccCtx); }

export function AccountDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile>(null);

  const load = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSignedIn(false); setProfile(null); setIsOpen(false); return; }
    setSignedIn(true);
    const { data } = await supabase.from('profiles').select('first_name,surname').eq('id', user.id).maybeSingle();
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
                <div className="acc-member-eyebrow">Sanctum Society</div>
                <div className="acc-member-name">{fullName}</div>
                {profile?.email && <div className="acc-member-email">{profile.email}</div>}
              </div>

              <nav className="acc-nav">
                <Link href="/account" className="acc-link" onClick={close}>Saved venues</Link>
                <Link href="/account" className="acc-link" onClick={close}>My bookings</Link>
                <Link href="/account" className="acc-link" onClick={close}>My profile</Link>
                <Link href="/account" className="acc-link" onClick={close}>Account settings</Link>
              </nav>
            </div>

            <div className="acc-foot">
              <form action={signOut}>
                <button type="submit" className="acc-logout">Log out</button>
              </form>
            </div>
          </aside>
        </>
      )}
    </AccCtx.Provider>
  );
}
