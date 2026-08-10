'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { adoptVenues } from '@/app/actions/brands';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   VENUES THAT LOOK LIKE THEY BELONG HERE

   Most chains were catalogued property by property long before the brand
   existed. Thirty-five Six Senses records were in the database with
   nothing tying them together, and a brand read that ignored them would
   have produced thirty-five more beside them.

   Nothing is linked without somebody agreeing. The scoring pushes down
   anything that reads as an event or a programme held at a venue rather
   than the venue — but "Rosebar Longevity at Six Senses Ibiza" is a
   judgement, not a rule.
   ═══════════════════════════════════════════════════════════════════════ */

export default function BrandCandidates({
  brandId, candidates,
}: { brandId: number; candidates: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  // Anything confident is ticked; the rest is a decision.
  const [chosen, setChosen] = useState<Set<number>>(
    new Set(candidates.filter((c) => c.score >= 0.6).map((c) => c.venue_id)));
  const [msg, setMsg] = useState('');

  if (!candidates.length) return null;

  const toggle = (id: number) => {
    const next = new Set(chosen);
    next.has(id) ? next.delete(id) : next.add(id);
    setChosen(next);
  };

  const likely = candidates.filter((c) => c.score >= 0.6);
  const doubtful = candidates.filter((c) => c.score < 0.6);

  const Row = ({ c }: { c: Row }) => (
    <tr key={c.venue_id}>
      <td style={{ width: 30 }}>
        <input type="checkbox" data-bwignore checked={chosen.has(c.venue_id)}
          style={{ cursor: 'pointer' }}
          onChange={() => toggle(c.venue_id)} />
      </td>
      <td>
        <Link href={`/venues/${c.venue_id}/details`} style={{ textDecoration: 'none' }}>
          <span className="v-name" style={{ fontSize: 15 }}>{c.venue_name}</span>
        </Link>
        {c.why && <div className="v-slug" style={{ maxWidth: 420 }}>{c.why}</div>}
      </td>
      <td className="v-slug">{c.country ?? '—'}</td>
      <td className="v-slug">{Math.round(Number(c.score) * 100)}%</td>
    </tr>
  );

  return (
    <div className="sect">
      <h3>Already here, not yet linked</h3>
      <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
        {candidates.length} look like they belong to this brand
      </div>

      {msg && <div className="note">{msg}</div>}

      <div className="note">
        Linking changes nothing about a venue except which brand it sits under. Each keeps its
        own services, prices and listing — that is the whole point of them being separate.
      </div>

      <table>
        <thead>
          <tr><th></th><th>Venue</th><th>Country</th><th>How sure</th></tr>
        </thead>
        <tbody>
          {likely.map((c) => <Row key={c.venue_id} c={c} />)}
        </tbody>
      </table>

      {!!doubtful.length && (
        <>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
                        color: 'var(--ink-quiet)', margin: 'var(--s5) 0 var(--s3)' }}>
            Less sure — left unticked
          </div>
          <table>
            <tbody>
              {doubtful.map((c) => <Row key={c.venue_id} c={c} />)}
            </tbody>
          </table>
        </>
      )}

      <button className="btn" disabled={pending || !chosen.size}
        style={{ marginTop: 'var(--s4)' }}
        onClick={() => start(async () => {
          report('saving');
          const r = await adoptVenues(brandId, Array.from(chosen));
          setMsg(r.ok ? (r.message ?? '') : (r as any).error);
          report(r.ok ? 'saved' : 'error');
        })}>
        Take {chosen.size} into the brand
      </button>
    </div>
  );
}
