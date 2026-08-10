'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { adoptVenues, correctCountry, setWebsite } from '@/app/actions/brands';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   TIDYING A BRAND

   Four problems that usually get looked at separately, together because
   they compound. A duplicate with no website is two records neither of
   which will ever be filled in.

   Within a brand, duplicates are far easier to spot than across the whole
   database — the location name is the only thing that should differ.
   "Six Senses Vana" and "Six Senses Vana, Dehradun, India" are obviously
   one place once you know the brand; among 5,888 venues they are two
   names sharing a word.
   ═══════════════════════════════════════════════════════════════════════ */

const ORDER = [
  'Not linked to the brand',
  'Probably the same place',
  'The country looks wrong',
  'No website recorded',
];

export default function BrandTidy({
  brandId, rows,
}: { brandId: number; rows: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [urls, setUrls] = useState<Record<number, string>>({});

  if (!rows.length) return null;

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
  });

  const byKind = (kind: string) => rows.filter((r) => r.kind === kind);
  const unlinked = byKind('Not linked to the brand');
  const dupes = byKind('Probably the same place');
  const countries = byKind('The country looks wrong');
  const noSite = byKind('No website recorded');

  return (
    <div className="sect">
      <h3>Tidying this brand</h3>
      <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
        {ORDER.map((k) => {
          const n = byKind(k).length;
          return n ? `${n} ${k.toLowerCase()}` : null;
        }).filter(Boolean).join(' · ')}
      </div>

      {msg && <div className="note">{msg}</div>}

      {!!unlinked.length && (
        <>
          <h4 style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 300,
                       margin: 'var(--s5) 0 var(--s3)' }}>
            Not linked yet
          </h4>
          <div className="note">
            {unlinked.length} records begin with this brand&rsquo;s name and sit under nothing.
            Linking changes only which brand they belong to — each keeps its own services,
            prices and listing.
          </div>
          <button className="btn" disabled={pending}
            onClick={() => act(() => adoptVenues(brandId,
              unlinked.map((r) => r.venue_id)))}>
            Link all {unlinked.length}
          </button>
        </>
      )}

      {!!dupes.length && (
        <>
          <h4 style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 300,
                       margin: 'var(--s5) 0 var(--s3)' }}>
            Probably the same place
          </h4>
          <div className="note">
            Merging keeps one record and folds the other into it. Do this after linking, since
            a merged record should already be under the brand.
          </div>
          <table>
            <thead><tr><th>Keep</th><th>Fold in</th><th>Why</th><th></th></tr></thead>
            <tbody>
              {dupes.map((d, i) => (
                <tr key={i}>
                  <td>
                    <Link href={`/venues/${d.venue_id}/details`}
                          style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 14 }}>{d.venue_name}</span>
                    </Link>
                  </td>
                  <td>
                    <Link href={`/venues/${d.other_id}/details`}
                          style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 14 }}>{d.other_name}</span>
                    </Link>
                  </td>
                  <td className="v-slug">{d.detail}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="link-btn"
                          href={`/venues/duplicates?keep=${d.venue_id}&merge=${d.other_id}`}>
                      Compare
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!!countries.length && (
        <>
          <h4 style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 300,
                       margin: 'var(--s5) 0 var(--s3)' }}>
            The country looks wrong
          </h4>
          <table>
            <tbody>
              {countries.map((c, i) => {
                const says = c.detail?.match(/says (.+)$/)?.[1];
                return (
                  <tr key={i}>
                    <td>
                      <Link href={`/venues/${c.venue_id}/location`}
                            style={{ textDecoration: 'none' }}>
                        <span className="v-name" style={{ fontSize: 14 }}>{c.venue_name}</span>
                      </Link>
                      <div className="v-slug">{c.detail}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {says && (
                        <button className="link-btn" disabled={pending}
                          onClick={() => act(() => correctCountry(c.venue_id, says))}>
                          Move to {says}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {!!noSite.length && (
        <>
          <h4 style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 300,
                       margin: 'var(--s5) 0 var(--s3)' }}>
            No website
          </h4>
          <div className="note">
            {noSite.length} records with nothing to read, so nothing will ever fill them in.
            A brand read finds these pages and matches them, which is usually faster than
            pasting {noSite.length} addresses by hand.
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12.5,
                              color: 'var(--ink-gold)' }}>
              Add them one at a time instead
            </summary>
            <table style={{ marginTop: 'var(--s3)' }}>
              <tbody>
                {noSite.map((n) => (
                  <tr key={n.venue_id}>
                    <td style={{ width: '40%' }}>
                      <span className="v-name" style={{ fontSize: 14 }}>{n.venue_name}</span>
                    </td>
                    <td>
                      <input data-bwignore placeholder="https://"
                        value={urls[n.venue_id] ?? ''}
                        style={{ background: 'var(--warm-white)',
                                 border: '1px solid var(--border-input)',
                                 padding: '5px 7px', fontSize: 12, width: '100%' }}
                        onChange={(e) => setUrls({ ...urls, [n.venue_id]: e.target.value })}
                        onBlur={(e) => e.target.value.trim()
                          && act(() => setWebsite(n.venue_id, e.target.value))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
