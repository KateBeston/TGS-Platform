'use client';

import { useEffect } from 'react';
import { existingCartToken } from '@/lib/cartToken';
import { renewHolds } from '@/app/actions/slotHold';

/* ═══════════════════════════════════════════════════════════════════════
   KEEPING A HELD TIME WHILE SOMEBODY IS STILL ON THE SCREEN

   A hold lasts twenty minutes. That is long enough to choose a time and
   too short to then fill in the health form, read the cancellation terms
   and check out, and nothing extended it. So the hold lapsed under a
   guest who was sitting right there, and they found out at submit, by
   which point another cart could have taken the slot.

   WHY VISIBILITY RATHER THAN A TIMER ALONE

   A renewal has to mean somebody is still here. A plain interval would
   keep a venue's afternoon held by a tab that was abandoned hours ago,
   which is the opposite of what holds are for: they exist so a time is
   not promised to two people, not so one person can sit on it. So
   nothing is renewed while the tab is hidden, and a tab coming back to
   the front renews at once rather than waiting for the next tick.

   Deliberately not the abandonment signal used in track.ts, which avoids
   visibilitychange on purpose — switching tabs is not leaving. Here it is
   exactly the right question, because the thing being asked is whether
   anybody is looking.

   The real bound is on the server. renew_cart_holds will not revive a
   lapsed hold and will not renew one more than two hours old, so a
   screen left visible in an empty room runs out regardless of what this
   keeps asking.
   ═══════════════════════════════════════════════════════════════════════ */

/** Well inside twenty minutes, so one missed tick is not a lost hold. */
const EVERY_MS = 8 * 60 * 1000;

/**
 *  Renew this cart's holds while `active` and the tab is in front.
 *
 *  Silent by design. A renewal that works changes nothing the guest can
 *  see, which is the point: the time they chose simply stays theirs. A
 *  renewal that fails leaves the hold as it was, which is where they
 *  stood before any of this existed.
 */
export function useKeepHolds(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let stopped = false;

    const tick = () => {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const token = existingCartToken();
      /* No token means no holds to keep. Nothing is minted here. */
      if (!token) return;
      void renewHolds(token).catch(() => { /* never break the page */ });
    };

    /* Once on arrival, so somebody who reached this screen slowly is not
       waiting out a full interval on a hold that is nearly up. */
    tick();

    const id = window.setInterval(tick, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active]);
}
