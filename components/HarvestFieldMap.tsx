'use client';

import Link from 'next/link';
import { useState } from 'react';
import { NOT_HARVESTED, type HarvestField } from '@/lib/harvestFields';

type Col = { column_name: string; data_type: string; is_nullable: boolean };

/* ═══════════════════════════════════════════════════════════════════════
   FIELD MAP

   Every field the harvest can propose, checked against the live schema.

   The check matters more than the list. "setting" was proposed for weeks
   against a column that did not exist, and nothing caught it — the
   proposals looked fine and would have failed on apply. A mapping that
   cannot verify itself will drift, and quietly.
   ═══════════════════════════════════════════════════════════════════════ */

const EXPECTED_TYPE: Record<string, string[]> = {
  text: ['text', 'character varying'],
  number: ['integer', 'bigint', 'numeric', 'double precision', 'smallint'],
  boolean: ['boolean'],
  reference: ['bigint', 'integer'],
};

export default function HarvestFieldMap({
  fields, schema, proposed, applied, silent,
}: {
  fields: HarvestField[];
  schema: Col[];
  proposed: Record<string, number>;
  applied: Record<string, number>;
  silent: Record<string, number>;
}) {
  const [pass, setPass] = useState<'all' | 'Structured' | 'AI'>('all');
  const byName = new Map(schema.map((c) => [c.column_name, c]));

  const checked = fields.map((f) => {
    const col = byName.get(f.column);
    const typeOk = col ? (EXPECTED_TYPE[f.type] ?? []).includes(col.data_type) : false;
    return {
      ...f,
      exists: !!col,
      dbType: col?.data_type ?? null,
      typeOk,
      state: !col ? 'missing' : !typeOk ? 'mismatch' : 'ok',
    };
  });

  const broken = checked.filter((c) => c.state !== 'ok');
  const visible = pass === 'all'
    ? checked
    : checked.filter((c) => c.pass === pass || c.pass === 'Both');

  return (
    <>
      <div className="ph">
        <div>
          <h2>What the harvest reads</h2>
          <div className="ph-sub">
            {fields.length} fields · checked against {schema.length} columns on the venue record
          </div>
        </div>
        <div className="ph-act">
          {(['all', 'Structured', 'AI'] as const).map((p) => (
            <button key={p} className={`btn ${pass === p ? '' : 'quiet'}`}
              onClick={() => setPass(p)}>
              {p === 'all' ? 'Both passes' : p === 'AI' ? 'Read with Claude' : 'Structured'}
            </button>
          ))}
        </div>
      </div>

      {broken.length > 0 ? (
        <div className="note bad">
          <strong>{broken.length} mapping{broken.length === 1 ? '' : 's'} broken.</strong>{' '}
          {broken.map((b) => b.label).join(', ')} — either the column is gone or it holds a
          different type than the harvest sends. Proposals for these will fail when applied.
        </div>
      ) : (
        <div className="note">
          <strong>Every mapping checks out.</strong> All {fields.length} fields exist on the venue
          record and hold the type the harvest sends.</div>
      )}

      <div className="sect">
        <h3>Fields</h3>
        <table>
          <thead>
            <tr>
              <th>Field</th><th>Where it comes from</th><th>Column</th>
              <th>Proposed</th><th>Applied</th><th>Site silent</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f) => (
              <tr key={f.column} style={{
                background: f.state !== 'ok' ? 'rgba(180,60,50,.05)' : undefined,
              }}>
                <td style={{ maxWidth: 200 }}>
                  <span className="v-name" style={{ fontSize: 16 }}>{f.label}</span>
                  <div style={{ marginTop: 3 }}>
                    <span className="pill empty" style={{ fontSize: 9 }}>
                      {f.pass === 'Both' ? 'Both passes'
                        : f.pass === 'AI' ? 'Claude' : 'Structured'}
                    </span>
                    {f.risk === 'watch' && (
                      <span className="pill" style={{ fontSize: 9, marginLeft: 4,
                        borderColor: 'var(--warn)', color: 'var(--warn)' }}>Check</span>
                    )}
                  </div>
                </td>
                <td style={{ maxWidth: 290 }}>
                  <div style={{ fontSize: 13 }}>{f.source}</div>
                  {f.note && (
                    <div className="v-slug" style={{ marginTop: 3, lineHeight: 1.5 }}>{f.note}</div>
                  )}
                </td>
                <td className="v-slug" style={{ whiteSpace: 'nowrap' }}>
                  {f.exists ? (
                    <>
                      {f.column}
                      <div style={{ color: f.typeOk ? undefined : 'var(--bad)' }}>
                        {f.dbType}{!f.typeOk && ` — expected ${f.type}`}
                      </div>
                    </>
                  ) : (
                    <span className="pill" style={{ borderColor: 'var(--bad)',
                                                    color: 'var(--bad)' }}>Missing</span>
                  )}
                </td>
                <td>{proposed[f.column] ?? <span className="pill empty">0</span>}</td>
                <td className="v-slug">{applied[f.column] ?? 0}</td>
                <td className="v-slug">{silent[f.column] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sect">
        <h3>What it does not attempt</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          Recorded so the absence reads as a decision rather than an oversight
        </div>
        <table>
          <tbody>
            {NOT_HARVESTED.map((n) => (
              <tr key={n.what}>
                <td style={{ width: 220 }}>
                  <span className="v-name" style={{ fontSize: 16 }}>{n.what}</span>
                </td>
                <td className="v-slug" style={{ lineHeight: 1.55 }}>{n.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="note" style={{ marginBottom: 0 }}>
        <strong>Nothing here writes on its own.</strong> Every value becomes a proposal carrying
        the text it came from, and waits for a decision in{' '}
        <Link href="/venues/harvest/review" style={{ color: 'var(--ink-gold)' }}>
          review by field</Link>. Fields marked <em>Check</em> are the ones where a wrong value
        would be quiet rather than obvious.
      </div>
    </>
  );
}
