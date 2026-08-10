'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { timedOut } from '@/app/actions/auth';

/** How long counts as idle, and how long the warning shows.
 *
 *  Two hours is about the point where the friction stays invisible.
 *  Thirty minutes is banking, and an aggressive timeout on a tool used
 *  all day trains people to stay logged in on unlocked machines — which
 *  is worse than the thing it prevents.
 */
const IDLE_MS = 120 * 60 * 1000;
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const WARN_MS = 5 * 60 * 1000;

/** Activity, meaning a person rather than a page.
 *
 *  Scroll is deliberately included and mousemove deliberately throttled —
 *  an unthrottled mousemove listener fires hundreds of times a second and
 *  costs more than the feature is worth.
 */
const EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export default function SessionTimeout({ signedInAt }: { signedInAt?: string }) {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(WARN_MS);
  const lastActive = useRef(Date.now());
  const started = useRef(signedInAt ? new Date(signedInAt).getTime() : Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const end = useCallback(async (reason: 'Timed out' | 'Session ended') => {
    if (timer.current) clearInterval(timer.current);
    // Recorded before signing out, since afterwards there is no session
    // to record it with.
    await timedOut(reason);
  }, []);

  const stayOn = useCallback(() => {
    lastActive.current = Date.now();
    setWarning(false);
    setRemaining(WARN_MS);
  }, []);

  useEffect(() => {
    // Throttled to once a second. A person cannot be idle and active
    // within the same second, so finer resolution buys nothing.
    let ready = true;
    const note = () => {
      if (!ready) return;
      ready = false;
      setTimeout(() => { ready = true; }, 1000);
      lastActive.current = Date.now();
      // Only closes the warning if it is showing — otherwise every
      // keystroke triggers a state update for nothing.
      setWarning((w) => (w ? false : w));
    };

    EVENTS.forEach((e) => window.addEventListener(e, note, { passive: true }));

    // Activity in one tab counts in all of them. Without this, working
    // in a second tab still times out the first.
    const heard = (e: StorageEvent) => {
      if (e.key === 'tgs-active' && e.newValue) {
        lastActive.current = Number(e.newValue);
        setWarning(false);
      }
    };
    window.addEventListener('storage', heard);

    const broadcast = setInterval(() => {
      try { localStorage.setItem('tgs-active', String(lastActive.current)); } catch {}
    }, 20_000);

    timer.current = setInterval(() => {
      const idle = Date.now() - lastActive.current;
      const total = Date.now() - started.current;

      if (total >= ABSOLUTE_MS) { void end('Session ended'); return; }
      if (idle >= IDLE_MS) { void end('Timed out'); return; }

      if (idle >= IDLE_MS - WARN_MS) {
        setWarning(true);
        setRemaining(IDLE_MS - idle);
      }
    }, 5_000);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, note));
      window.removeEventListener('storage', heard);
      clearInterval(broadcast);
      if (timer.current) clearInterval(timer.current);
    };
  }, [end]);

  if (!warning) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(49,49,49,.5)',
      display: 'grid', placeItems: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--warm-white)', border: '1px solid var(--border)',
        borderTop: '3px solid var(--gold)', padding: 'var(--s6)',
        maxWidth: 420, width: '90%',
      }}>
        <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase',
                      color: 'var(--ink-gold)' }}>
          Still there?
        </div>

        <h2 style={{ fontSize: 25, margin: 'var(--s3) 0 var(--s4)' }}>
          Signing out in {mins}:{String(secs).padStart(2, '0')}
        </h2>

        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-quiet)',
                    margin: '0 0 var(--s5)' }}>
          Nothing has happened here for a while. Anything typed and not saved will still be
          there when you sign back in — fields save as you leave them.
        </p>

        <div style={{ display: 'flex', gap: 'var(--s3)' }}>
          <button className="btn" style={{ flex: 1 }} onClick={stayOn}>
            Stay signed in
          </button>
          <button className="btn quiet" onClick={() => void end('Timed out')}>
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
