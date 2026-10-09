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
  /* Building the cart */
  | 'add' | 'remove' | 'quantity_change' | 'cart_view'
  /* Leaving the cart for the steps */
  | 'checkout_start' | 'checkout_abandon'
  /* Each screen between the cart and payment; `step` says which */
  | 'step_view' | 'step_complete' | 'step_back' | 'step_blocked'
  /* The payment screen, which does not exist yet */
  | 'payment_start' | 'payment_failed' | 'payment_success'
  | 'book';

/* The screens between the cart and the payment.
 *
 * Named after the routes rather than invented: host and health are what
 * bookingSteps resolves from the database, checkout is the review, and
 * payment is the screen still to be built. A loose string here would
 * become four spellings of "health" and then the funnel is guesswork. */
export type BookingStepName = 'host' | 'health' | 'checkout' | 'payment';

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
  /* Which screen, for the step_* and payment_* events. */
  step?: BookingStepName | null;
  venueId?: number | null;
  itemType?: 'room' | 'space' | 'package' | 'exp' | 'extra' | 'buyout' | null;
  itemId?: number | null;
  /* The catalogue code, so an abandoned cart can be read as "nobody
     finishes when the sound bath is in it" rather than just a number. */
  itemCode?: string | null;
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

/** One screen of the booking flow, reported as it is reached and left.
 *
 *  Separate from trackCartEvent only for readability at the call site:
 *  trackStep('health', 'view') reads as what it is, where
 *  trackCartEvent({ eventType: 'step_view', step: 'health' }) does not.
 */
export function trackStep(
  step: BookingStepName,
  what: 'view' | 'complete' | 'back' | 'blocked',
  metadata?: Record<string, unknown>,
) {
  trackCartEvent({
    eventType: (`step_${what}` as CartEventType),
    step,
    metadata: metadata ?? null,
  });
}

/* Fired once per step per session, so a screen that re-renders — and
   these all do, on every field change — does not report itself twenty
   times and turn one visit into twenty in the funnel. */
const stepsSeen = new Set<string>();

export function trackStepOnce(
  step: BookingStepName,
  what: 'view' | 'complete' | 'back' | 'blocked',
  metadata?: Record<string, unknown>,
) {
  const key = `${step}:${what}`;
  if (stepsSeen.has(key)) return;
  stepsSeen.add(key);
  trackStep(step, what, metadata);
}
