/* The pieces a document is assembled from. Every one draws its styling
   from documents.css, so a new document composes rather than styles. */

import type React from 'react';

/** A titled block. `avoidBreak` keeps it on one page where it is short
 *  enough — a heading orphaned at the foot of a page is the commonest
 *  print failure. */
export function DocSection({
  title, subtitle, avoidBreak = true, children,
}: {
  title?: string;
  subtitle?: string;
  avoidBreak?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={avoidBreak ? 'doc-block' : undefined}>
      {title && <h2>{title}</h2>}
      {subtitle && <h3>{subtitle}</h3>}
      {children}
    </div>
  );
}

/** Key and value pairs. Rows with no value are dropped rather than
 *  printed empty — a document full of dashes reads as unfinished. */
export function DocFacts({
  rows,
}: { rows: [string, React.ReactNode | null | undefined][] }) {
  const shown = rows.filter(([, v]) =>
    v !== null && v !== undefined && v !== '' && v !== false);
  if (!shown.length) return null;
  return (
    <dl className="doc-dl">
      {shown.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A timed or sequenced row: a left column for when, a right for what. */
export function DocEntry({
  when, whenSub, title, tag, description, meta, aside,
}: {
  when?: React.ReactNode;
  whenSub?: React.ReactNode;
  title: React.ReactNode;
  tag?: string;
  description?: React.ReactNode;
  meta?: React.ReactNode[];
  aside?: React.ReactNode;
}) {
  const parts = (meta ?? []).filter(Boolean);
  return (
    <div className="doc-item">
      <div className="doc-when">
        {when ?? '—'}
        {whenSub && <div>{whenSub}</div>}
      </div>
      <div>
        <div className="doc-what">
          {title}
          {tag && <span className="doc-tag">{tag}</span>}
        </div>
        {description && <div className="doc-meta" style={{ fontSize: 13 }}>{description}</div>}
        {!!parts.length && (
          <div className="doc-meta">
            {parts.map((m, i) => <span key={i}>{i > 0 && ' · '}{m}</span>)}
          </div>
        )}
        {aside && <div className="doc-aside">{aside}</div>}
      </div>
    </div>
  );
}

export function DocList({
  items,
}: { items: { text: React.ReactNode; note?: React.ReactNode }[] }) {
  if (!items.length) return null;
  return (
    <ul className="doc-list">
      {items.map((it, i) => (
        <li key={i}>
          {it.text}
          {it.note && <div className="doc-meta">{it.note}</div>}
        </li>
      ))}
    </ul>
  );
}

export function DocTable({
  head, rows,
}: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return null;
  return (
    <table>
      <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function DocCallout({ children }: { children: React.ReactNode }) {
  return <div className="doc-callout">{children}</div>;
}

/** 14:30 reads as 2:30 pm — how it would be said aloud, and how it should
 *  appear on anything sent to a person. */
export function docTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [hs, ms] = String(t).slice(0, 5).split(':');
  const h = Number(hs);
  if (Number.isNaN(h)) return String(t);
  const suffix = h < 12 ? 'am' : 'pm';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return ms === '00' ? `${twelve} ${suffix}` : `${twelve}:${ms} ${suffix}`;
}

export function docDate(d: string | null | undefined, long = true): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-AU',
    long ? { day: 'numeric', month: 'long', year: 'numeric' }
         : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function docDay(d: string): string {
  return new Date(d).toLocaleDateString('en-AU',
    { weekday: 'long', day: 'numeric', month: 'long' });
}
