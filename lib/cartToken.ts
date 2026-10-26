'use client';

/* Who this cart is, for the purpose of holding a time.
 *
 * A treatment at two o'clock is one two o'clock. Until this existed nothing
 * held it: two guests could both put the same slot in their carts, both
 * reach checkout and both be told it was theirs, because free_slots was
 * only ever asked the version of the question that ignores holds. The
 * database has had slot_holds, hold_service_slot, release_service_hold and
 * a hold-aware free_slots the whole time, and the marketplace had never
 * mentioned any of them.
 *
 * The token is what ties a hold to the cart that made it. It is also what
 * lets the guest keep seeing their own held time as available — free_slots
 * subtracts every live hold except the ones carrying this token, so without
 * it a guest would watch the slot they just chose disappear from the
 * picker.
 *
 * ── why localStorage, and why not the analytics session id ────────────
 * It has to outlive a reload and a closed tab, because the cart does: it
 * lives in localStorage and a guest who comes back tomorrow still has it.
 * tgs_sid is the wrong thing twice over — it is in sessionStorage, so it
 * dies with the tab, and its fallback branch generates something that is
 * not a uuid at all, which this column will not take.
 *
 * Cleared with the cart at the end of checkout, so the next booking starts
 * a new one and cannot inherit a stranger's holds on a shared computer.
 */

const KEY = 'tgs_cart_token';

/* A v4 uuid without crypto.randomUUID, for the handful of browsers and
   insecure-origin cases where it is missing. getRandomValues is far more
   widely available; Math.random is the last resort and is fine here,
   because this is a name for a cart and not a secret. */
function uuidv4(): string {
  try {
    const b = new Uint8Array(16);
    (self.crypto as Crypto).getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

/** This cart's token, made on first use and kept until the cart is cleared. */
export function cartToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = localStorage.getItem(KEY);
    /* Validated rather than trusted. Anything can be put in localStorage,
       and a value that is not a uuid would be refused by the database on
       every call with nothing to show why. */
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }
    const made = uuidv4();
    localStorage.setItem(KEY, made);
    return made;
  } catch {
    /* Private mode, or storage blocked. No token means no holds, and the
       guest can still book — they simply race for the slot the way everyone
       did before this. Better than a broken page. */
    return null;
  }
}

/** Forget this cart's token. Called where the cart itself is cleared. */
export function clearCartToken() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
