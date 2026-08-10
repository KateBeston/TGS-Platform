'use client';

import {
  RELATION_LABELS, renderEditorial, renderTechnical,
  type ProseParts,
} from '@/lib/settingProse';

/* ═══════════════════════════════════════════════════════════════════════
   SETTING, SHOWN

   One record, two presentations.

   `technical` is for a venue profile or an internal document: labelled
   rows, exact distances, no implication. A host comparing four venues
   wants the same terms on every page.

   `editorial` is for a listing: a small-caps label, a serif heading, a
   paragraph, and pills. A guest deciding where to go is reading, not
   comparing.

   The pills carry which kind each is. A beach the venue sits on and a
   beach twenty minutes away should not look identical, because they are
   not the same offer.
   ═══════════════════════════════════════════════════════════════════════ */

const PILL_STYLE = {
  immediate: { borderColor: 'var(--gold)', color: 'var(--ink)' },
  regional:  { borderColor: 'var(--border)', color: 'var(--ink-quiet)' },
  reachable: { borderColor: 'var(--border)', color: 'var(--ink-quiet)',
               borderStyle: 'dashed' as const },
};

export function SettingTechnical({ parts }: { parts: ProseParts }) {
  const rows = renderTechnical(parts);
  if (!rows.length) return null;

  return (
    <dl className="doc-dl">
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'contents' }}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SettingEditorial({
  parts, labelOverride, headingOverride, bodyOverride,
}: {
  parts: ProseParts;
  /** What the listing editor has written. Their words replace the
   *  assembled ones entirely — the draft exists to be improved on. */
  labelOverride?: string | null;
  headingOverride?: string | null;
  bodyOverride?: string | null;
}) {
  const draft = renderEditorial(parts);
  const label = labelOverride ?? draft?.label ?? null;
  const heading = headingOverride ?? draft?.heading ?? null;
  const body = bodyOverride ?? draft?.body ?? null;
  if (!label && !heading && !body && !draft?.pills.length) return null;

  return (
    <div>
      {label && (
        <div style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase',
                      color: 'var(--ink-gold)' }}>{label}</div>
      )}
      {heading && (
        <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 30,
                     lineHeight: 1.15, margin: '10px 0 0' }}>{heading}</h3>
      )}
      {body && (
        <p style={{ fontSize: 14.5, lineHeight: 1.65, margin: '16px 0 0',
                    maxWidth: '58ch' }}>{body}</p>
      )}
      {!!draft?.pills.length && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 20 }}>
          {draft.pills.map((p, i) => (
            <span key={i} className="pill" style={PILL_STYLE[p.kind]}>{p.text}</span>
          ))}
        </div>
      )}
      {!!draft?.pills.filter((p) => p.kind === 'reachable').length && (
        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8,
                      letterSpacing: '.04em' }}>
          Dashed — nearby rather than on site
        </div>
      )}
    </div>
  );
}

/** The register names, so a screen can say which voice it is showing. */
export const REGISTERS = RELATION_LABELS;
