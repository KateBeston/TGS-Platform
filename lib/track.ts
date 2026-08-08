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
