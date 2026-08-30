/* The steps between the cart and checkout.
 *
 * Which steps a booking needs is decided by the booking_steps function in the
 * database, not here, so the screens, the checkout guard and the server-side
 * write all ask the same question. A component that decided for itself would
 * eventually disagree with the one next to it.
 *
 * Acknowledgements are kept in localStorage so a guest can move between the
 * steps without losing them. That is convenience, not security: the browser's
 * word is not evidence, and submitBooking re-resolves the steps and refuses a
 * booking whose steps are outstanding.
 */

export type StepName = 'host' | 'health';

export type BookingStep = {
  step: StepName;
  step_order: number;
  venue_id: number;
  reason: string;
};

const ACK_KEY = 'tgs_steps_ack';

type Queryable = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };

/** The venue ids, service ids and hire flag a cart implies. */
export function cartShape(cart: { venues?: Record<string, any> } | null) {
  const venues = Object.values(cart?.venues ?? {});
  const venueIds: number[] = [];
  const serviceIds: number[] = [];
  const roomVenueIds: number[] = [];
  let hasHire = false;

  for (const v of venues as any[]) {
    if (typeof v.venueId === 'number') venueIds.push(v.venueId);
    for (const item of v.items ?? []) {
      // 'exp' is a wellness service; 'buyout' is whole-venue hire.
      if (item.kind === 'exp' && typeof item.id === 'number') serviceIds.push(item.id);
      if (item.kind === 'buyout') hasHire = true;
      // Which venues have accommodation in the cart. Whether that counts as a
      // hire is the venue's question, not the item's: four rooms at a retreat
      // venue is a group arriving to run something, the same four at a
      // wellness venue is a stay. The resolver decides from venue_category.
      if (item.kind === 'room' && typeof v.venueId === 'number') roomVenueIds.push(v.venueId);
    }
    if (v.buyout) hasHire = true;
  }
  return {
    venueIds: Array.from(new Set(venueIds)),
    serviceIds: Array.from(new Set(serviceIds)),
    roomVenueIds: Array.from(new Set(roomVenueIds)),
    hasHire,
  };
}

/** Ask the database which steps this cart needs, in order. */
export async function resolveSteps(db: Queryable, cart: any): Promise<BookingStep[]> {
  const { venueIds, serviceIds, roomVenueIds, hasHire } = cartShape(cart);
  if (!venueIds.length) return [];
  try {
    const { data } = await db.rpc('booking_steps', {
      p_venue_ids: venueIds,
      p_service_ids: serviceIds,
      p_has_hire: hasHire,
      p_room_venue_ids: roomVenueIds,
    });
    const rows = (data ?? []) as BookingStep[];
    // One entry per step name; a venue can give several reasons for the same step.
    const seen = new Set<string>();
    return rows
      .filter((r) => (seen.has(r.step) ? false : (seen.add(r.step), true)))
      .sort((a, b) => a.step_order - b.step_order);
  } catch {
    // A step we cannot resolve must not silently disappear. Failing closed
    // would strand every booking, so we fail open here and rely on
    // submitBooking, which resolves server-side and can refuse.
    return [];
  }
}

export function readAcks(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(ACK_KEY) ?? '{}'); } catch { return {}; }
}

export function recordAck(step: StepName) {
  const acks = readAcks();
  acks[step] = true;
  try { localStorage.setItem(ACK_KEY, JSON.stringify(acks)); } catch { /* ignore */ }
}

export function clearAcks() {
  try { localStorage.removeItem(ACK_KEY); } catch { /* ignore */ }
}

/** Where a guest should go next: the first outstanding step, or checkout. */
export function nextDestination(steps: BookingStep[], acks: Record<string, boolean>): string {
  const outstanding = steps.find((s) => !acks[s.step]);
  return outstanding ? `/booking/${outstanding.step}` : '/checkout';
}

export const STEP_PATHS: Record<StepName, string> = {
  host: '/booking/host',
  health: '/booking/health',
};
