'use client';

/* Events, fired on a confirmed success rather than on a click.
 *
 * The audit is explicit about this and it matters more than it sounds.
 * An event on click counts the person who pressed send and got a 500,
 * and the person who pressed twice. Conversion numbers built that way
 * are wrong in the flattering direction, which is the worst direction
 * for a number to be wrong in.
 */

type Payload = Record<string, string | number | boolean | null | undefined>;

export function track(event: string, payload: Payload = {}) {
  if (typeof window === 'undefined') return;
  const w = window as any;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...payload });
}

/* Fired once per page, however many times it is called.
 *
 * A form that re-renders after submitting would otherwise push the event
 * again on every render. */
const fired = new Set<string>();

export function trackOnce(event: string, payload: Payload = {}) {
  const key = `${event}:${JSON.stringify(payload)}`;
  if (fired.has(key)) return;
  fired.add(key);
  track(event, payload);
}

/* ── First-party behavioural cart tracking ──
 * Separate from the GTM/dataLayer events above: this writes one row to
 * cart_events (via /api/cart-event), sharing the page-view session id
 * (sessionStorage 'tgs_sid') so the funnel joins on session_id. Analytics
 * only — never the financial record of a booking. Never throws or blocks. */

export type CartEventType =
  | 'add' | 'remove' | 'quantity_change' | 'cart_view' | 'checkout_start' | 'checkout_abandon' | 'book';

/* Where an add came from.
 *
 * Without this, a massage added from a suggestion is indistinguishable from
 * one added on the listing page, and there is no way to tell whether "Worth
 * adding" earns its place — only that adds happened.
 *
 * A named union rather than a loose string, because free text becomes six
 * spellings of the same thing and then the report is guesswork. */
export type CartSource =
  | 'listing'        // the venue page, where most adds happen
  | 'suggestion'     // Worth adding, in the panel
  | 'suggestion_booking' // Worth adding, on the booking page
  | 'panel'          // the panel's own starting list, when nothing is chosen
  | 'card';          // a venue card, before the listing was opened

export type CartEvent = {
  eventType: CartEventType;
  /* Recorded in metadata, so no migration and no new column. */
  source?: CartSource;
  venueId?: number | null;
  itemType?: 'room' | 'space' | 'package' | 'exp' | 'extra' | 'buyout' | null;
  itemId?: number | null;
  quantity?: number | null;
  unitPrice?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function trackCartEvent(e: CartEvent) {
  try {
    if (typeof window === 'undefined') return;
    let sid = sessionStorage.getItem('tgs_sid');
    if (!sid) {
      sid = (self.crypto as { randomUUID?: () => string })?.randomUUID?.() ?? String(Math.random()).slice(2) + Date.now();
      sessionStorage.setItem('tgs_sid', sid);
    }
    fetch('/api/cart-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      /* Folded into metadata rather than added as a column: cart_events
         already carries jsonb for exactly this, and a column would need a
         migration to answer a question that may change shape. */
      body: JSON.stringify({
        ...e,
        sessionId: sid,
        metadata: e.source ? { ...(e.metadata ?? {}), source: e.source } : e.metadata ?? null,
      }),
      keepalive: true,
    }).catch(() => { /* silent */ });
  } catch { /* never break the page */ }
}
