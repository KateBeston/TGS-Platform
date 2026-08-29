import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { readable } from '@/lib/legal';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ venueId: string; slug: string }> };

/* A venue's own document, at its own URL.
 *
 * The stay is a contract with the venue, so the venue's wording has to be
 * readable before booking, at booking, and afterwards from a link in a
 * confirmation email. Served from the venue register, so editing it in the
 * portal changes this page on the next load.
 *
 * The cancellation policy is deliberately not here. It stays structured in
 * cancellation_policies, where it drives the date-aware label and the refund
 * arithmetic, and is shown on the listing from that single source. Copying it
 * into a document would let the words and the maths drift apart. */

type VenueDoc = {
  name: string;
  summary: string | null;
  document_type: string;
  version_label: string | null;
  effective_from: string | null;
  body: string;
  venue_name: string | null;
};

async function venueDoc(venueId: number, slug: string): Promise<VenueDoc | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('venue_legal_documents')
    .select('name,summary,document_type,venues(venue_name),venue_legal_document_versions(version_label,effective_from,body,is_current)')
    .eq('venue_id', venueId)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!data) return null;

  const versions = (data as any).venue_legal_document_versions ?? [];
  const current = versions.find((v: any) => v.is_current);
  if (!current) return null;

  return {
    name: (data as any).name,
    summary: (data as any).summary ?? null,
    document_type: (data as any).document_type,
    version_label: current.version_label ?? null,
    effective_from: current.effective_from ?? null,
    body: current.body,
    venue_name: (data as any).venues?.venue_name ?? null,
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { venueId, slug } = await params;
  const id = Number(venueId);
  if (!Number.isFinite(id)) return { title: 'Not found' };
  const doc = await venueDoc(id, slug);
  if (!doc) return { title: 'Not found' };

  return {
    title: doc.venue_name ? `${doc.name} — ${doc.venue_name}` : doc.name,
    description: doc.summary ?? undefined,
    // Readable by anyone with the link, but the venue's own terms are not
    // something for the site to rank on.
    robots: { index: false, follow: true },
  };
}

export default async function VenueLegalDocPage({ params }: Params) {
  const { venueId, slug } = await params;
  const id = Number(venueId);
  if (!Number.isFinite(id)) notFound();

  const doc = await venueDoc(id, slug);
  if (!doc) notFound();

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb"><Link href="/legal">Legal</Link></div>
          <h1 style={{ marginTop: 'var(--s4)' }}>{doc.name}</h1>
          <div className="legal-meta">
            {doc.venue_name && <span>{doc.venue_name}</span>}
            {doc.version_label && <span>{doc.version_label}</span>}
            {doc.effective_from && (
              <span>In force from {new Date(doc.effective_from)
                .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            )}
          </div>
          {doc.summary && <p className="legal-summary">{doc.summary}</p>}
        </div>
      </section>

      <div className="wrap">
        <div className="legal-panel">
          <div className="legal-body">
            {readable(doc.body).map((b, i) =>
              b.kind === 'heading' ? <h3 key={i}>{b.text}</h3>
                : <p key={i} className={b.kind === 'bullet' ? 'legal-bullet' : ''}>
                    {b.text}
                  </p>
            )}
          </div>
        </div>

        <p className="legal-foot">
          This document is the venue&rsquo;s own and governs your stay.
          The Global Sanctum introduces and arranges the booking and is not a party to it.
          The Global Sanctum is operated by Aurella Group Pty Ltd, ABN 70 649 742 423.
        </p>
      </div>
    </>
  );
}
