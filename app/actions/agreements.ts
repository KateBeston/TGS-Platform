'use server';

import { createClient } from '@/lib/supabase/server';

/* ═══════════════════════════════════════════════════════════════════════
   WHAT THIS BASKET CALLS FOR

   One question, asked once, answered from the item codes behind the
   cart: which agreements this person is being asked to accept, from
   whom, and what each one actually says.

   WHY THE TEXT IS FETCHED HERE AND NOT IN THE RESOLVER

   agreements_for_items returns which documents and which versions, and
   stops there. Bodies run to tens of thousands of characters and the
   resolver is useful in places that only want to know what applies --
   the portal, a readiness check -- so it stays light and the text is
   asked for separately, by version id, only where it is going to be
   read.

   WHY FULL TEXT RATHER THAN THE SUMMARY

   The summary is the line on the closed section, so somebody can see
   what each part is before opening it. Opening it shows the document.
   A panel that only ever showed summaries would be asking people to
   accept something they were never shown.
   ═══════════════════════════════════════════════════════════════════════ */

export type AgreementDoc = {
  slug: string;
  name: string;
  summary: string | null;
  versionId: number;
  versionLabel: string | null;
  /** 'The Global Sanctum' or 'the venue'. */
  party: string;
  venueName: string | null;
  body: string;
};

export type PracticeAlert = {
  practice: string;
  healthScreening: boolean;
  hardRequirement: boolean;
  requirementDetail: string | null;
  culturalGate: boolean;
  accessCondition: string | null;
};

export type ResolvedAgreements = {
  documents: AgreementDoc[];
  alerts: PracticeAlert[];
  /** Anything that resolved to no text at all, so a gap is visible. */
  missingText: string[];
};

const EMPTY: ResolvedAgreements = { documents: [], alerts: [], missingText: [] };

export async function agreementsForCart(
  items: { kind?: string | null; id?: number | string | null }[],
): Promise<ResolvedAgreements> {
  const lines = (items ?? [])
    .filter((i) => i && i.kind && i.id != null)
    .map((i) => ({ kind: String(i.kind), id: Number(i.id) }))
    .filter((i) => Number.isFinite(i.id) && i.id > 0);

  if (!lines.length) return EMPTY;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('agreements_for_cart', { p_items: lines });
  if (error || !data) {
    console.error('[agreementsForCart] could not resolve', error?.message);
    return EMPTY;
  }

  const resolved = data as {
    documents?: any[]; venue_documents?: any[]; alerts?: any[];
  };

  const tgs = resolved.documents ?? [];
  const venue = resolved.venue_documents ?? [];

  /* Bodies in two reads, because the two kinds of document live in two
     tables. A version with no text is not dropped silently -- it comes
     back in missingText, because a section with nothing in it is a thing
     somebody needs to know about rather than a blank on a screen. */
  const tgsIds = tgs.map((d) => Number(d.version_id)).filter(Boolean);
  const venueIds = venue.map((d) => Number(d.version_id)).filter(Boolean);

  const [tgsBodies, venueBodies] = await Promise.all([
    tgsIds.length
      ? supabase.from('legal_document_versions').select('id, body').in('id', tgsIds)
      : Promise.resolve({ data: [] as any[] }),
    venueIds.length
      ? supabase.from('venue_legal_document_versions').select('id, body').in('id', venueIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const bodyOf = new Map<string, string>();
  for (const r of (tgsBodies as any).data ?? []) bodyOf.set(`t${r.id}`, r.body ?? '');
  for (const r of (venueBodies as any).data ?? []) bodyOf.set(`v${r.id}`, r.body ?? '');

  const missingText: string[] = [];

  const shape = (d: any, prefix: 't' | 'v'): AgreementDoc => {
    const body = bodyOf.get(`${prefix}${d.version_id}`) ?? '';
    if (!body.trim()) missingText.push(String(d.name));
    return {
      slug: String(d.slug),
      name: String(d.name),
      summary: d.summary ?? null,
      versionId: Number(d.version_id),
      versionLabel: d.version_label ?? null,
      party: String(d.party ?? 'The Global Sanctum'),
      venueName: d.venue_name ?? null,
      body,
    };
  };

  return {
    /* TGS first, then the venue's own. Somebody should see who each
       agreement is with, and grouping by party is how that reads. */
    documents: [...tgs.map((d) => shape(d, 't')), ...venue.map((d) => shape(d, 'v'))],
    alerts: (resolved.alerts ?? []).map((a) => ({
      practice: String(a.practice),
      healthScreening: !!a.health_screening,
      hardRequirement: !!a.hard_requirement,
      requirementDetail: a.requirement_detail ?? null,
      culturalGate: !!a.cultural_gate,
      accessCondition: a.access_condition ?? null,
    })),
    missingText,
  };
}
