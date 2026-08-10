'use client';

import Link from 'next/link';
import {
  REGISTERS, TGS_FOOTER, type BrandingRegister, type DocumentKind,
} from '@/lib/documents';

type Host = {
  display_name?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  contact_email?: string | null;
  footer_line?: string | null;
} | null;

/* The frame every printable document sits in.
 *
 * It owns the masthead, the title block, the branding register, the print
 * toolbar and the footer. A document supplies its content and nothing
 * else — no CSS, no print rules, no footer logic. That is the point: four
 * documents with four copies of the same rules is four things to keep in
 * step, and they will not stay in step. */
export default function DocShell({
  kind, audience, branding, host,
  backHref, backLabel = 'Back',
  title, subtitles, intro, reference, exports, warning, children,
}: {
  kind: DocumentKind;
  audience: string;
  branding: BrandingRegister;
  host?: Host;
  backHref: string;
  backLabel?: string;
  title: string;
  subtitles?: (string | null | undefined)[];
  intro?: React.ReactNode;
  reference?: string;
  exports?: { label: string; href: string }[];
  warning?: string;
  children: React.ReactNode;
}) {
  const hostName = host?.display_name ?? null;
  const hostLogo = host?.logo_url ?? null;
  const showTgsMark = branding === 'TGS';
  const currentAudience = kind.audiences.find((a) => a.key === audience)
    ?? kind.audiences[0];

  const link = (a: string, b: BrandingRegister) =>
    `?audience=${encodeURIComponent(a)}&branding=${encodeURIComponent(b)}`;

  const footerLeft =
    branding === 'White label'
      ? [hostName, host?.website_url, host?.contact_email].filter(Boolean).join(' · ')
      : branding === 'Endorsed'
        ? [[hostName, host?.website_url].filter(Boolean).join(' · '),
           'Curated with The Global Sanctum'].filter(Boolean).join(' — ')
        : TGS_FOOTER;

  return (
    <>
      <div className="no-print" style={{ padding: 'var(--s5) var(--s6) 0' }}>
        <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
          <Link href={backHref}>{backLabel}</Link>
        </div>

        {(kind.audiences.length > 1 || kind.allowBrandingChoice) && (
          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                        flexWrap: 'wrap', marginBottom: 'var(--s3)' }}>
            {kind.audiences.map((a) => (
              <Link key={a.key} className={`btn ${audience === a.key ? '' : 'quiet'}`}
                    href={link(a.key, branding)}>{a.label}</Link>
            ))}
            {kind.allowBrandingChoice && (
              <>
                <span style={{ width: 1, height: 22, background: 'var(--border)' }} />
                {REGISTERS.map((b) => (
                  <Link key={b} className={`btn ${branding === b ? '' : 'quiet'}`}
                        href={link(audience, b)}>{b}</Link>
                ))}
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                      flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
          <button className="btn" onClick={() => window.print()}>Print or save as PDF</button>
          {(exports ?? []).map((e) => (
            <a key={e.href} className="btn quiet" href={e.href}>{e.label}</a>
          ))}
        </div>

        <div className="note">
          <strong>Before printing:</strong> turn on <em>Background graphics</em> and turn off{' '}
          <em>Headers and footers</em>, or the browser adds its own URL and page number.
          {currentAudience?.note && <> {currentAudience.note}</>}
          {branding !== 'TGS' && !hostName && (
            <> <strong style={{ color: 'var(--bad)' }}>No host name recorded</strong>, so the
            masthead falls back to the title.</>
          )}
        </div>
      </div>

      <div className="doc-wrap">
        <div className="doc">
          <div className="doc-masthead">
            {showTgsMark ? (
              <img className="doc-logo" src="/tgs-logo.svg" alt="The Global Sanctum" />
            ) : hostLogo ? (
              <img className="doc-logo" src={hostLogo} alt={hostName ?? 'Host'} />
            ) : (
              <div className="doc-hostname">{hostName ?? title}</div>
            )}
            <div>
              <div className="doc-kind">
                {kind.label}{audience === 'internal' ? ' · internal' : ''}
              </div>
              {reference && <div className="doc-ref">{reference}</div>}
            </div>
          </div>

          <h1>{title}</h1>
          {(subtitles ?? []).filter(Boolean).map((s, i) => (
            <div className="doc-sub" key={i}>{s}</div>
          ))}
          <div className="doc-rule" />

          {intro && <div className="doc-intro">{intro}</div>}
          {warning && (
            <div className="doc-warn">
              <strong>{warning}</strong> Not for sending outside TGS in this state.
            </div>
          )}

          {children}

          <div className="doc-foot">
            <span>{host?.footer_line ?? footerLeft}</span>
            {audience !== 'internal' && <span>Prepared {new Date().toLocaleDateString('en-AU')}</span>}
          </div>
        </div>
      </div>
    </>
  );
}
