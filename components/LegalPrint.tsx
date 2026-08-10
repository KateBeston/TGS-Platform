'use client';

import Link from 'next/link';
import DocShell from './doc/DocShell';
import { DocFacts, DocSection, docDate } from './doc/DocParts';
import { DOCUMENT_KINDS } from '@/lib/documents';
import { readingMinutes, renderLegal } from '@/lib/legalRender';

type Row = Record<string, any>;

export default function LegalPrint({
  doc, version, versions, entity, audience,
}: {
  doc: Row; version: Row | null; versions: Row[];
  entity: Record<string, string>;
  audience: 'public' | 'internal';
}) {
  const kind = DOCUMENT_KINDS.legal;
  const internal = audience === 'internal';
  const html = renderLegal(version?.body);
  const minutes = readingMinutes(version?.body);

  return (
    <>
      <style>{`
        .legal-body h2{font-family:var(--serif);font-weight:400;font-size:22px;
                       margin:26px 0 8px;line-height:1.25;}
        .legal-body h3{font-family:var(--serif);font-weight:400;font-size:18px;
                       margin:20px 0 6px;line-height:1.3;}
        .legal-body h3.clause .num{color:var(--ink-gold);margin-right:8px;
                                   font-family:var(--sans);font-size:12px;
                                   letter-spacing:.06em;}
        .legal-body h4{font-family:var(--sans);font-weight:600;font-size:12px;
                       letter-spacing:.1em;text-transform:uppercase;
                       color:var(--ink-quiet);margin:18px 0 6px;}
        .legal-body p{margin:0 0 11px;font-size:13.5px;line-height:1.68;}
        .legal-body ul,.legal-body ol{margin:0 0 12px;padding-left:20px;}
        .legal-body li{font-size:13.5px;line-height:1.62;margin-bottom:5px;}
        .legal-body a{color:var(--ink-gold);}
        .legal-body hr{border:0;border-top:1px solid var(--border);margin:22px 0;}
        @media print{
          .legal-body h2,.legal-body h3{break-after:avoid;}
          .legal-body li,.legal-body p{break-inside:avoid;}
        }
      `}</style>

      <DocShell
        kind={kind}
        audience={audience}
        branding="TGS"
        backHref={`/legal/${doc.id}`}
        backLabel="Back to the document"
        title={doc.name}
        reference={version?.version_label ?? undefined}
        subtitles={[
          entity.legal_entity_name
            ? `${entity.legal_entity_name}${entity.abn ? ` · ABN ${entity.abn}` : ''}`
            : null,
          version?.effective_from
            ? `In force from ${docDate(version.effective_from)}`
            : 'No effective date set',
          minutes ? `About ${minutes} minute${minutes === 1 ? '' : 's'} to read` : null,
        ]}
        warning={!version?.body
          ? 'This document has no wording yet.'
          : !doc.is_published && !internal
            ? 'This document is a draft and is not published.'
            : undefined}
        exports={[
          { label: 'Markdown', href: `/api/legal/${doc.slug}?format=md` },
          { label: 'Plain text', href: `/api/legal/${doc.slug}?format=txt` },
        ]}
      >
        {internal && (
          <DocSection title="Record">
            <DocFacts rows={[
              ['Version', version?.version_label],
              ['In force from', docDate(version?.effective_from)],
              ['In force to', version?.effective_to
                ? docDate(version.effective_to) : 'Current'],
              ['What changed', version?.change_summary],
              ['Approved by', version?.approved_by],
              ['Total versions', versions.length > 1 ? versions.length : null],
              ['Published', doc.is_published ? 'Yes' : 'Draft'],
              ['Requires acceptance', doc.requires_acceptance ? 'Yes' : 'No'],
              ['Jurisdiction', doc.jurisdiction],
              ['Public address', doc.is_published
                ? `theglobalsanctum.com/legal/${doc.slug}` : null],
            ]} />
          </DocSection>
        )}

        {html ? (
          <div className="legal-body" style={{ marginTop: 'var(--s5)' }}
               dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p style={{ marginTop: 24, fontSize: 14, color: 'var(--ink-quiet)' }}>
            No wording has been written for this document yet.
          </p>
        )}

        {internal && versions.length > 1 && (
          <DocSection title="Version history">
            <table>
              <thead><tr><th>Version</th><th>From</th><th>To</th><th>Changed</th></tr></thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>{v.version_label ?? '—'}{v.is_current && ' · current'}</td>
                    <td>{docDate(v.effective_from, false) ?? '—'}</td>
                    <td>{v.effective_to ? docDate(v.effective_to, false) : 'Current'}</td>
                    <td>{v.change_summary ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DocSection>
        )}
      </DocShell>

      {versions.length > 1 && (
        <div className="no-print" style={{ padding: '0 var(--s6) var(--s6)' }}>
          <div className="note" style={{ marginBottom: 0 }}>
            <strong>Printing an earlier version.</strong> If someone questions what they agreed
            to, the wording in force on that date can be produced — choose it here.
            <div style={{ marginTop: 'var(--s3)', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {versions.map((v) => (
                <Link key={v.id} className={`pill ${version?.id === v.id ? 'gold' : ''}`}
                      style={{ textDecoration: 'none' }}
                      href={`/legal/${doc.id}/print?audience=${audience}&version=${v.id}`}>
                  {v.version_label ?? 'Untitled'}
                  {v.effective_from && ` · ${docDate(v.effective_from, false)}`}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
