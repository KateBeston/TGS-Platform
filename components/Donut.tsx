'use client';

/* Hand-drawn SVG rather than a charting library: no dependency to install,
   and the palette is the brand's rather than a library's defaults.
   A donut is used over a pie because the centre carries the total, which is
   the number people look for first. */

export type Slice = { label: string; value: number };

// Gold through to charcoal. Ordered so the largest slice takes the strongest
// tone and the tail recedes, which is how the eye should read it.
const TONES = ['#C4A265', '#A98A54', '#8E7344', '#7A644F', '#5C5346', '#4A4238', '#313131'];

export default function Donut({
  slices, size = 200, thickness = 34, empty,
}: { slices: Slice[]; size?: number; thickness?: number; empty?: string }) {
  const data = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, s) => sum + s.value, 0);

  if (!total) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: size, border: '1px dashed var(--border-input)',
                    color: 'var(--ink-quiet)', fontSize: 12, textAlign: 'center',
                    padding: 'var(--s4)' }}>
        {empty ?? 'No data yet'}
      </div>
    );
  }

  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = data.map((s, i) => {
    const fraction = s.value / total;
    const arc = {
      ...s,
      tone: TONES[i % TONES.length],
      dash: fraction * circumference,
      gap: circumference - fraction * circumference,
      offset: -offset,
      percent: Math.round(fraction * 100),
    };
    offset += fraction * circumference;
    return arc;
  });

  return (
    <div style={{ display: 'flex', gap: 'var(--s5)', alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <g transform={`rotate(-90 ${c} ${c})`}>
          {arcs.map((a) => (
            <circle key={a.label} cx={c} cy={c} r={r}
              fill="none" stroke={a.tone} strokeWidth={thickness}
              strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={a.offset} />
          ))}
        </g>
        <text x={c} y={c - 4} textAnchor="middle" dominantBaseline="middle"
              style={{ fontFamily: 'var(--serif)', fontSize: 30, fill: 'var(--ink)' }}>
          {total.toLocaleString('en-AU')}
        </text>
        <text x={c} y={c + 18} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 9, letterSpacing: '1.6px', textTransform: 'uppercase',
                       fill: 'var(--ink-quiet)' }}>
          total
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 180 }}>
        {arcs.map((a) => (
          <div key={a.label} style={{ display: 'flex', alignItems: 'center',
                                      gap: 'var(--s3)', marginBottom: 7 }}>
            <span style={{ width: 10, height: 10, background: a.tone, flex: 'none' }} />
            <span style={{ flex: 1, fontSize: 13 }}>{a.label}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-quiet)',
                           fontVariantNumeric: 'tabular-nums' }}>
              {a.value.toLocaleString('en-AU')} · {a.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
