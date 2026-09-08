/* Documents a guest accepts when they request a booking.
 *
 * Nothing here is hardcoded. A document appears at checkout when it is
 * published and flagged `requires_acceptance` in the register, and a venue's
 * own document appears when the venue's document is published. Publishing one
 * in the portal changes checkout on the next page load, the same way the rest
 * of the legal register works.
 *
 * That matters for a second reason: the guest must be shown exactly what gets
 * recorded against them. Both the display and the write read the same views,
 * so the two cannot drift.
 */

export type AcceptanceDoc = {
  document_id: number;
  slug: string;
  name: string;
  summary: string | null;
  document_type: string;
  display_order: number | null;
  version_id: number;
  version_label: string | null;
  effective_from: string | null;
  body_length: number | null;
  body_sha256: string | null;
};

export type VenueAcceptanceDoc = AcceptanceDoc & {
  venue_id: number;
  show_in_good_to_know: boolean;
};

const TGS_COLUMNS =
  'document_id,slug,name,summary,document_type,display_order,version_id,version_label,effective_from,body_length,body_sha256';
const VENUE_COLUMNS = `${TGS_COLUMNS},venue_id,show_in_good_to_know`;

type Queryable = {
  from: (t: string) => {
    select: (c: string) => {
      order: (c: string, o: { ascending: boolean; nullsFirst: boolean }) => any;
    };
  };
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

/* What kind of booking this is, worked out from what is in it.
 *
 * Not from the venue's class. A venue can be marked for both marketplaces and
 * that says nothing about what this person is doing there: booking one
 * treatment at a retreat venue makes you a wellness guest, and showing you a
 * retreat host agreement is both wrong and off-putting.
 *
 * So the signal is the line items.
 *   Hiring a space, or the whole venue, or bringing a group to stay
 *     → running something → Retreat.
 *   Booking a treatment or a session
 *     → attending something → Wellness.
 *
 * A booking can be both, and then it is both. Rooms alone are ambiguous — a
 * couple booking a suite and a host housing their group choose the same line —
 * so rooms defer to the venue's marketplace, which is the one case where the
 * class is the best evidence available.
 */
export type BookingContext = 'Wellness' | 'Retreat';

export function contextsFromBooking(
  slices: { marketplace?: string | null; items?: { kind?: string }[] }[],
): BookingContext[] {
  const found = new Set<BookingContext>();

  for (const slice of slices) {
    const kinds = new Set((slice.items ?? []).map((i) => i.kind));

    /* Unambiguous either way. */
    if (kinds.has('space') || kinds.has('buyout')) found.add('Retreat');
    if (kinds.has('exp')) found.add('Wellness');

    /* Rooms on their own say nothing about intent, so fall back to what the
       venue is. A venue marked for both, booked as rooms only, stays
       undetermined rather than guessing — and undetermined returns the
       universal documents, which is the safe direction to be wrong in. */
    const onlyRooms = kinds.size > 0
      && ![...kinds].some((k) => k === 'space' || k === 'buyout' || k === 'exp');
    if (onlyRooms) {
      if (slice.marketplace === 'Retreat') found.add('Retreat');
      else if (slice.marketplace === 'Wellness') found.add('Wellness');
    }
  }

  return [...found];
}

/** TGS documents this booking calls for. Same call from the browser and the
 *  server.
 *
 *  Contexts come from the line items. Passing none returns the universal
 *  documents only, which is deliberately the safe direction: too few is a
 *  gap somebody can close, too many is a guest being asked to accept terms
 *  that do not apply to them. */
export async function fetchTgsAcceptanceDocs(
  db: Queryable,
  contexts: BookingContext[] = [],
): Promise<AcceptanceDoc[]> {
  const { data } = await db.rpc('booking_acceptance_docs', { p_contexts: contexts });
  return (data ?? []) as AcceptanceDoc[];
}

/** A venue's own documents, for the venues in this booking. */
export async function fetchVenueAcceptanceDocs(
  db: Queryable,
  venueIds: number[],
): Promise<VenueAcceptanceDoc[]> {
  if (!venueIds.length) return [];
  const { data } = await (db
    .from('venue_acceptance_documents')
    .select(VENUE_COLUMNS)
    .order('display_order', { ascending: true, nullsFirst: false }) as any)
    .in('venue_id', venueIds);
  return (data ?? []) as VenueAcceptanceDoc[];
}
