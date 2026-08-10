'use client';

import { useState, useTransition } from 'react';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const CATEGORY_ORDER = ['Practice', 'Gathering', 'Dining', 'Treatment'];

/* ═══════════════════════════════════════════════════════════════════════
   CAPACITY BY USAGE

   One space, several capacities, because they are different numbers.
   Curraweena's barn holds 18 for yoga or 40 seated — both true, and
   neither is "the capacity".

   It matters because a host bringing twenty people for breathwork needs
   the lying-down figure. Told forty, they book a room that will not hold
   them, and nobody finds out until the morning it starts.
   ═══════════════════════════════════════════════════════════════════════ */

export default function SpaceCapacityEditor({
  space, usages, capacities, onSave, onEstimate,
}: {
  space: Row;
  usages: Row[];
  capacities: Row[];
  onSave: (usageId: number, capacity: number | null) => Promise<any>;
  onEstimate: () => Promise<any>;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const byUsage = new Map(capacities.map((c) => [c.usage_id, c]));

  const areaSqm = space.area
    ? /sqft|sq ft|ft2/i.test(space.area_unit ?? '')
      ? Number(space.area) * 0.092903
      : Number(space.area)
    : null;

  const save = (usageId: number, raw: string) => start(async () => {
    report('saving');
    const n = raw.trim() === '' ? null : Number(raw);
    const res = await onSave(usageId, Number.isFinite(n as number) ? n : null);
    report(res?.ok === false ? 'error' : 'saved');
  });

  return (
    <>
      <div className="note">
        <strong>These are different numbers, not one number rounded.</strong></div>

      {areaSqm && (
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                      marginBottom: 'var(--s4)' }}>
          <button className="btn quiet" disabled={pending}
            onClick={() => start(async () => {
              report('saving');
              const res = await onEstimate();
              report(res?.ok === false ? 'error' : 'saved');
            })}>
            Work out the rest from {Math.round(areaSqm)} m²
          </button>
          <span className="help" style={{ margin: 0 }}>
            Fills only what is blank, and marks each as an estimate
          </span>
        </div>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const items = usages.filter((u) => u.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 'var(--s5)' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
                          color: 'var(--ink-quiet)', marginBottom: 'var(--s3)',
                          paddingBottom: 5, borderBottom: '1px solid var(--border)' }}>
              {cat}
            </div>
            <div className="grid">
              {items.map((u) => {
                const c = byUsage.get(u.id);
                const estimated = c?.source === 'Estimated from area';
                return (
                  <div className="f" key={u.id}>
                    <label>
                      {u.name}
                      {estimated && (
                        <span style={{ float: 'right', fontWeight: 400, letterSpacing: 0,
                                       textTransform: 'none', color: 'var(--warn)' }}>
                          estimated
                        </span>
                      )}
                    </label>
                    <input type="number" data-bwignore defaultValue={c?.capacity ?? ''}
                      placeholder="—"
                      style={{
                        background: 'var(--warm-white)',
                        border: `1px solid ${estimated ? 'var(--warn)' : 'var(--border-input)'}`,
                        padding: '8px 10px', width: '100%', fontSize: 14,
                      }}
                      onBlur={(e) => {
                        if (e.target.value !== String(c?.capacity ?? '')) {
                          save(u.id, e.target.value);
                        }
                      }} />
                    <span className="help">
                      {u.description}
                      {areaSqm && ` · about ${Math.floor(areaSqm / Number(u.sqm_per_person))} here`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="note" style={{ marginBottom: 0 }}>
        <strong>Estimates are marked and stay marked.</strong> A figure worked out from floor area
        is not something the venue told us, and a host booking on it should be able to tell the
        difference. Typing over one makes it a stated figure.
      </div>
    </>
  );
}
