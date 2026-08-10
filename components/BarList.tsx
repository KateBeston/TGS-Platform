'use client';

/* Horizontal bars. Better than a pie wherever there are more than about
   six categories, or where the comparison that matters is rank rather
   than share of a whole. */

export default function BarList({
  rows, empty, unit,
}: { rows: { label: string; value: number }[]; empty?: string; unit?: string }) {
  const data = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const max = Math.max(...data.map((r) => r.value), 1);

  if (!data.length) {
    return (
      <div style={{ border: '1px dashed var(--border-input)', padding: 'var(--s5)',
                    color: 'var(--ink-quiet)', fontSize: 12, textAlign: 'center' }}>
        {empty ?? 'No data yet'}
      </div>
    );
  }

  return (
    <div>
      {data.map((r) => (
        <div key={r.label} style={{ marginBottom: 'var(--s3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 13, marginBottom: 3 }}>
            <span>{r.label}</span>
            <span style={{ color: 'var(--ink-quiet)', fontVariantNumeric: 'tabular-nums' }}>
              {r.value.toLocaleString('en-AU')}{unit ? ` ${unit}` : ''}
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--warm-cream)' }}>
            <div style={{ height: '100%', width: `${(r.value / max) * 100}%`,
                          background: 'var(--gold)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
