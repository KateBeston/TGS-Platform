import type { Metadata } from 'next';
import Link from 'next/link';
import LegalTabs from '@/components/LegalTabs';
import { allLegalDocs, legalTabs, readable } from '@/lib/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Legal',
  description:
    'Terms and conditions, privacy policy, cookie policy, booking terms, '
    + 'refunds, health disclaimer, acceptable use and community standards.',
  alternates: { canonical: '/legal' },
};

/* The eight documents, on one route.
 *
 * Every word comes from the register, so editing a document in the
 * portal changes this page on the next load — no redeploy, no HTML to
 * find. That was the point of putting legal copy in the database.
 *
 * The wording served is the wording for the phase the platform is
 * actually in. During the concierge period the venue terms say there is
 * no subscription and a 10% introduction commission applies; when
 * subscriptions begin, the site serves the other version on its own. */

const ALIASES: Record<string, string> = {
  terms: 'terms-and-conditions',
  privacy: 'privacy-policy',
  cookies: 'cookie-policy',
  health: 'health-wellness-disclaimer',
  booking: 'booking-terms-and-conditions',
  refunds: 'refund-cancellation-policy',
  conduct: 'community-standards',
  use: 'acceptable-use-policy',
  'venue-owner': 'venue-owner-agreement',
  concierge: 'concierge-introduction-terms',
  accuracy: 'venue-data-accuracy-declaration',
  safety: 'health-safety-liability-declaration',
  host: 'retreat-host-agreement',
};

function Body({ body }: { body: string }) {
  return (
    <div className="legal-body">
      {readable(body).map((b, i) =>
        b.kind === 'heading' ? <h3 key={i}>{b.text}</h3>
          : <p key={i} className={b.kind === 'bullet' ? 'legal-bullet' : ''}>
              {b.text}
            </p>
      )}
    </div>
  );
}

export default async function LegalPage() {
  const [tabs, everything] = await Promise.all([legalTabs(), allLegalDocs()]);

  if (!tabs.length) {
    return (
      <div className="wrap" style={{ padding: 'var(--s8) 0' }}>
        <h1>Legal</h1>
        <p>These documents are being prepared. Ask us at{' '}
          <a href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>{' '}
          and we will send you whichever you need.</p>
      </div>
    );
  }

  // The agreements are readable at their own URL but are not tabs.
  // Nobody browses to a Venue Data Accuracy Declaration for pleasure —
  // they arrive from a form that asked them to sign it.
  const elsewhere = everything.filter((d) => !d.on_legal_page);

  return (
    <>
      <section className="page-head" id="legal-top">
        <div className="wrap">
          <div className="eyebrow">Legal</div>
          <h1>Terms, policies and standards</h1>
          <p className="page-sub">
            Everything that governs how The Global Sanctum works. Written to be
            read rather than to be scrolled past.
          </p>
        </div>
      </section>

      <div className="wrap">
        <LegalTabs tabs={tabs.map((t) => ({ slug: t.slug, name: t.name }))}
          aliases={ALIASES} />

        {tabs.map((doc, i) => (
          <section key={doc.slug} id={`legal-${doc.slug}`} className="legal-panel"
                   hidden={i !== 0}>
            <div className="legal-head">
              <h2>{doc.name}</h2>
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

            <Body body={doc.body} />
          </section>
        ))}

        {!!elsewhere.length && (
          <section className="legal-index">
            <h2>Other documents</h2>
            <p className="muted">
              Agreements signed at the point they apply, rather than browsed. Each
              is readable in full before you sign it.
            </p>
            <div className="legal-index-grid">
              {elsewhere.map((d) => (
                <Link key={d.slug} href={`/legal/${d.slug}`} className="legal-index-item">
                  <span className="legal-index-name">{d.name}</span>
                  {d.category && <span className="legal-index-cat">{d.category}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="legal-foot">
          Aurella Group Pty Ltd trading as The Global Sanctum, ABN 70 649 742 423.
          These documents are governed by the laws of Queensland, Australia. Nothing
          in them excludes rights under the Australian Consumer Law that cannot be
          excluded by agreement.
        </p>
      </div>
    </>
  );
}
