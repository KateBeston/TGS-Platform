'use client';

import { useEffect } from 'react';

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
  /* Saving a venue for later, and changing their mind */
  | 'favourite_add' | 'favourite_remove'
  /* Leaving the cart for the steps */
  | 'checkout_start' | 'checkout_abandon'
  /* Which way they chose to check out, and whether the nudge worked */
  | 'checkout_as_guest' | 'checkout_as_account'
  | 'account_prompt_shown' | 'account_created_at_checkout'
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
  itemType?: 'room' | 'space' | 'package' | 'exp' | 'extra' | 'svclen' | 'buyout' | null;
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

/* ═══════════════════════════════════════════════════════════════════════
   LEAVING A STEP WITHOUT FINISHING IT

   Every screen reported itself being reached and host and health reported
   being finished, so the funnel could already say how far somebody got.
   What it could not say was whether they left, or when: checkout_abandon
   was in the event vocabulary and in the booking_funnel view, and nothing
   had ever fired it, so the `abandoned` column was false on every row
   since the table was created.

   The portal's funnel screen works around that by treating "got past the
   cart and never booked" as abandonment. That is a fair inference and it
   is not the same fact. It cannot tell a cart left open in a background
   tab from one closed in irritation, it has no time of leaving, and it
   cannot say which screen lost them — only which was furthest.

   ── going back is not giving up ──────────────────────────────────────
   Someone returning to the cart to change a date has not abandoned
   anything, so the back links report step_back and mark the step as left
   on purpose. Without that, every correction a guest made would be filed
   as an abandonment and the number would be worthless in the flattering
   direction.

   ── why not visibilitychange ─────────────────────────────────────────
   It fires on switching tabs, which is not leaving. Using it would have
   reported an abandonment every time somebody checked their email, and a
   metric that counts ordinary behaviour as failure gets ignored within a
   week. pagehide fires on a real navigation away or a closed tab, and the
   cart_events fetch already sets keepalive so the row survives it.
   ═══════════════════════════════════════════════════════════════════════ */

/** Steps left deliberately, by going back. Not abandonment. */
const stepsLeftOnPurpose = new Set<string>();
/** Steps already reported as abandoned, so unmount and pagehide together
 *  cannot report the same leaving twice. */
const stepsAbandoned = new Set<string>();
/** Reports waiting to be sent, keyed by step, so a strict-mode remount can
 *  call one off before it goes. */
const pending: Partial<Record<BookingStepName, ReturnType<typeof setTimeout>>> = {};

/** Going back from a step. Reports it, and stops the leaving being read as
 *  an abandonment. */
export function trackStepBack(step: BookingStepName) {
  stepsLeftOnPurpose.add(step);
  trackStep(step, 'back');
}

/** Report this step abandoned, unless it was finished or left on purpose. */
function abandonStep(step: BookingStepName) {
  if (stepsSeen.has(`${step}:complete`)) return;
  if (stepsLeftOnPurpose.has(step)) return;
  if (stepsAbandoned.has(step)) return;
  stepsAbandoned.add(step);
  trackCartEvent({ eventType: 'checkout_abandon', step });
}

/** Watch a step for the guest leaving it unfinished.
 *
 *  `active` so a screen that redirects straight back out — the step was not
 *  required for this cart — does not report itself abandoned on the way
 *  past. Pass whatever the page uses to mean "this screen is really being
 *  shown".
 *
 *  Both routes out are covered: unmount catches in-app navigation, which
 *  is how Next moves between these screens and never fires pagehide, and
 *  pagehide catches the tab being closed or sent somewhere else entirely.
 */
export function useAbandonIfLeft(step: BookingStepName, active: boolean) {
  useEffect(() => {
    if (!active) return undefined;

    /* Strict mode mounts, unmounts and mounts again in development. Taken
       at face value that unmount is a guest leaving, so every page load in
       development would file an abandonment — and worse, the once-guard
       would then swallow the real one when it came.

       So the report is queued rather than sent, and a remount in the same
       tick cancels it. A genuine in-app navigation has no remount and the
       timer fires; a closed tab is caught by pagehide instead, which needs
       no timer because the fetch is sent with keepalive. */
    if (pending[step]) {
      clearTimeout(pending[step]);
      delete pending[step];
    }

    const onPageHide = () => abandonStep(step);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      /* If they finished, trackStepOnce has already recorded it and
         abandonStep does nothing when the timer runs. */
      pending[step] = setTimeout(() => {
        delete pending[step];
        abandonStep(step);
      }, 0);
    };
  }, [step, active]);
}
