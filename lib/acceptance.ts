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
};

/** TGS documents the guest accepts. Same call from the browser and the server. */
export async function fetchTgsAcceptanceDocs(db: Queryable): Promise<AcceptanceDoc[]> {
  const { data } = await db
    .from('booking_acceptance_documents')
    .select(TGS_COLUMNS)
    .order('display_order', { ascending: true, nullsFirst: false });
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
