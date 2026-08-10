'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Page size and page navigation. Carries every other filter through, so
 *  paging never silently drops a search or a sort. */
export default function Pager({
  page, pages, size, sizes, total, params,
}: {
  page: number; pages: number; size: number; sizes: number[];
  total: number; params: Record<string, string | undefined>;
}) {
  const router = useRouter();

  const href = (p: number, s: number = size) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && k !== 'page' && k !== 'size') q.set(k, v);
    });
    if (s !== 50) q.set('size', String(s));
    if (p > 1) q.set('page', String(p));
    return `/venues${q.toString() ? `?${q}` : ''}`;
  };

  // A window of five, not 118 links.
  const win: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = start; i < start + 5 && i <= pages; i++) win.push(i);

  const btn = (active: boolean) => ({
    padding: '7px 12px',
    border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    background: active ? 'var(--gold)' : 'transparent',
    color: active ? 'var(--on-gold)' : 'var(--ink)',
    textDecoration: 'none',
    fontSize: 12,
    cursor: 'pointer',
    fontVariantNumeric: 'tabular-nums' as const,
  });

  if (!total) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 'var(--s4)', flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
        <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                       color: 'var(--ink-quiet)' }}>Per page</span>
        <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" value={size} aria-label="Records per page"
          onChange={(e) => router.push(href(1, Number(e.target.value)))}
          style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                   padding: '6px 8px', fontSize: 12 }}>
          {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {page > 1 && <Link href={href(1)} style={btn(false)}>First</Link>}
          {page > 1 && <Link href={href(page - 1)} style={btn(false)}>Previous</Link>}
          {win.map((p) => (
            <Link key={p} href={href(p)} style={btn(p === page)}
                  aria-current={p === page ? 'page' : undefined}>{p}</Link>
          ))}
          {page < pages && <Link href={href(page + 1)} style={btn(false)}>Next</Link>}
          {page < pages && <Link href={href(pages)} style={btn(false)}>Last</Link>}
          <span style={{ fontSize: 12, color: 'var(--ink-quiet)', marginLeft: 'var(--s2)' }}>
            of {pages.toLocaleString('en-AU')}
          </span>
        </div>
      )}
    </div>
  );
}
