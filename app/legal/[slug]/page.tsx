import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { legalDoc, readable, resolveSlug } from '@/lib/legal';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

/* One document at its own URL.
 *
 * Every agreement is readable here, whether or not it is a tab, because
 * somebody being asked to sign something must be able to read it —
 * including from a link in an email months later. */

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = await legalDoc(slug);
  if (!doc) return { title: 'Not found' };

  return {
    title: doc.meta_title ?? doc.name,
    description: doc.meta_description ?? doc.summary ?? undefined,
    alternates: { canonical: `/legal/${doc.slug}` },
    // A document is not something to rank for; it is something to read
    // when linked. Indexed so it can be found, not pushed.
    robots: { index: true, follow: true },
  };
}

export default async function LegalDocPage({ params }: Params) {
  const { slug } = await params;
  const doc = await legalDoc(slug);
  if (!doc) notFound();

  // An old anchor lands here too; send it to the canonical slug.
  const canonical = resolveSlug(slug);

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb"><Link href="/legal">Legal</Link></div>
          <h1 style={{ marginTop: 'var(--s4)' }}>{doc.name}</h1>
          <div className="legal-meta">
            {doc.version_label && <span>{doc.version_label}</span>}
            {doc.effective_from && (
              <span>In force from {new Date(doc.effective_from)
                .toLocaleDateString('en-AU',
                  { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            )}
            {doc.applies_during !== 'Both' && (
              <span>{doc.applies_during === 'Interim'
                ? 'Applies during our concierge period'
                : 'Applies once subscriptions begin'}</span>
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
          Aurella Group Pty Ltd trading as The Global Sanctum, ABN 70 649 742 423.
          {canonical !== slug && (
            <> This document is also at <Link href={`/legal/${canonical}`}>
              /legal/{canonical}</Link>.</>
          )}
        </p>
      </div>
    </>
  );
}
