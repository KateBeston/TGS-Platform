'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthModal } from '@/components/AuthModal';

/* The saved-venues layer.
 *
 * Loads a signed-in member's saved venue ids once, so every heart on the
 * page renders in the right state without a query each. Toggling writes
 * through RLS (own rows only). Tapping a heart while signed out opens the
 * auth modal and remembers the venue, so the save completes the moment
 * they're in — the "sign in to finish what you were doing" flow. */

type SavedValue = { isSaved: (id: number) => boolean; toggle: (id: number) => void; ready: boolean };
const SavedCtx = createContext<SavedValue | null>(null);
export function useSaved() { return useContext(SavedCtx); }

export function SavedVenuesProvider({ children }: { children: ReactNode }) {
  const authModal = useAuthModal();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const pending = useRef<number | null>(null);

  const load = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) { setIds(new Set()); setReady(true); return; }
    const { data } = await supabase.from('profile_saved_venues').select('venue_id');
    const next = new Set<number>((data ?? []).map((r: { venue_id: number }) => r.venue_id));
    setIds(next);
    setReady(true);
    if (pending.current != null) {
      const v = pending.current; pending.current = null;
      setIds((p) => new Set(p).add(v));
      await supabase.from('profile_saved_venues')
        .upsert({ user_id: user.id, venue_id: v }, { onConflict: 'user_id,venue_id' });
    }
  };

  useEffect(() => {
    load();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (venueId: number) => {
    if (!userId) { pending.current = venueId; authModal?.open('signup'); return; }
    const supabase = createClient();
    if (ids.has(venueId)) {
      setIds((p) => { const n = new Set(p); n.delete(venueId); return n; });
      await supabase.from('profile_saved_venues').delete().eq('user_id', userId).eq('venue_id', venueId);
    } else {
      setIds((p) => new Set(p).add(venueId));
      await supabase.from('profile_saved_venues').insert({ user_id: userId, venue_id: venueId });
    }
  };

  return (
    <SavedCtx.Provider value={{ isSaved: (id) => ids.has(id), toggle, ready }}>
      {children}
    </SavedCtx.Provider>
  );
}

export function FavouriteButton({
  venueId, variant = 'card',
}: { venueId: number; variant?: 'card' | 'hero' }) {
  const saved = useSaved();
  const is = saved?.isSaved(venueId) ?? false;
  return (
    <button
      type="button"
      className={`fav-btn fav-${variant}${is ? ' fav-on' : ''}`}
      aria-label={is ? 'Remove from saved' : 'Save this venue'}
      aria-pressed={is}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); saved?.toggle(venueId); }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M12 20.3s-6.8-4.4-9.1-8.4C1.6 9.6 2.5 6.3 5.4 5.5 7.4 5 9.3 5.9 12 8.6c2.7-2.7 4.6-3.6 6.6-3.1 2.9.8 3.8 4.1 2.5 6.4-2.3 4-9.1 8.4-9.1 8.4z"
          fill={is ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4"
        />
      </svg>
    </button>
  );
}
