'use client';

import { useState } from 'react';

export type Flag = {
  flag?: string;
  name?: string;
  slug?: string;
  severity: string;
  colour: string;
  what_it_means?: string;
  description?: string;
  handling?: string | null;
  detail?: string | null;
  jurisdictions?: string | null;
};

/* ═══════════════════════════════════════════════════════════════════════
   PRACTICE FLAGS

   Colour by severity, not by category — the question at a glance is how
   serious, not what kind. Critical and High are both warm; cultural is
   purple because it is a different sort of caution and reading it as
   danger would be wrong.

   Detail is behind a click. A flag that shouts on every screen gets
   ignored, and the ones here are worth reading when they matter.
   ═══════════════════════════════════════════════════════════════════════ */

export function FlagPills({
  flags, size = 'normal',
}: { flags: Flag[]; size?: 'normal' | 'small' }) {
  if (!flags.length) return null;

  const order = ['Critical', 'High', 'Moderate', 'Note'];
  const sorted = [...flags].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {sorted.map((f, i) => (
        <span key={i} className="pill"
          title={f.detail ?? f.what_it_means ?? f.description ?? undefined}
          style={{
            borderColor: f.colour,
            color: f.colour,
            fontSize: size === 'small' ? 9 : 10,
            // Critical alone gets weight. Everything bold is nothing bold.
            fontWeight: f.severity === 'Critical' ? 600 : 400,
          }}>
          {f.flag ?? f.name}
        </span>
      ))}
    </div>
  );
}

export default function PracticeFlagPanel({
  flags, practiceName,
}: { flags: Flag[]; practiceName?: string }) {
  const [open, setOpen] = useState(false);
  if (!flags.length) return null;

  const critical = flags.filter((f) => f.severity === 'Critical');
  const order = ['Critical', 'High', 'Moderate', 'Note'];
  const sorted = [...flags].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${sorted[0].colour}`,
      padding: 'var(--s4)',
      marginBottom: 'var(--s4)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: 'var(--s4)' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase',
                        color: 'var(--ink-quiet)', marginBottom: 6 }}>
            {critical.length
              ? 'Before this is offered'
              : 'Worth knowing'}
          </div>
          <FlagPills flags={flags} />
        </div>
        <button className="link-btn" onClick={() => setOpen(!open)}>
          {open ? 'Less' : 'Why'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 'var(--s4)' }}>
          {sorted.map((f, i) => (
            <div key={i} style={{
              paddingTop: i ? 'var(--s3)' : 0,
              marginTop: i ? 'var(--s3)' : 0,
              borderTop: i ? '1px solid var(--border)' : undefined,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: f.colour }}>
                {f.flag ?? f.name}
                <span style={{ fontWeight: 400, color: 'var(--ink-quiet)', fontSize: 11 }}>
                  {' · '}{f.severity}
                </span>
              </div>

              {f.detail && (
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: '6px 0 0',
                            maxWidth: '72ch' }}>{f.detail}</p>
              )}

              {f.jurisdictions && (
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--ink-gold)' }}>
                  Where: {f.jurisdictions}
                </div>
              )}

              {(f.what_it_means ?? f.description) && !f.detail && (
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: '6px 0 0',
                            maxWidth: '72ch' }}>
                  {f.what_it_means ?? f.description}
                </p>
              )}

              {f.handling && (
                <div style={{ fontSize: 12, marginTop: 6, color: 'var(--ink-quiet)',
                              fontStyle: 'italic' }}>
                  {f.handling}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
