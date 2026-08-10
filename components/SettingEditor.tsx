'use client';

import { useState, useTransition } from 'react';
import { addSetting, removeSetting, saveSettingLink } from '@/app/actions/settings';
import { distancePhrase, RELATION_LABELS } from '@/lib/settingProse';
import { SettingEditorial, SettingTechnical } from './SettingDisplay';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const CATEGORIES = ['Water', 'Landscape', 'Climate', 'Density', 'Character'];
const MODES = ['Walk', 'Drive', 'Boat', 'Transfer'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   SETTING

   Three kinds of statement, not three levels of importance.

   What the venue is in. What it can reach, and how far. What is true of
   the region regardless. A rainforest venue twenty minutes from the coast
   is rainforest with beach access — not both equally, and not one
   outranking the other.
   ═══════════════════════════════════════════════════════════════════════ */

export default function SettingEditor({
  venueId, catalogue, links, inherited, prose,
}: {
  venueId: number; catalogue: Row[]; links: Row[]; inherited: Row[]; prose: Row | null;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState<'Immediate' | 'Reachable' | null>(null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res?.ok === false ? res.error : '');
    report(res?.ok === false ? 'error' : 'saved');
  });

  const immediate = links.filter((l) => l.relation === 'Immediate');
  const reachable = links.filter((l) => l.relation === 'Reachable');
  const used = new Set(links.map((l) => l.setting_id));
  const [register, setRegister] = useState<'editorial' | 'formal'>('editorial');

  const picker = (relation: 'Immediate' | 'Reachable') => (
    <div className="grid" style={{ marginTop: 'var(--s3)' }}>
      {CATEGORIES.map((cat) => {
        const items = catalogue.filter((s) => s.category === cat && !used.has(s.id));
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
                          color: 'var(--ink-quiet)', marginBottom: 6 }}>{cat}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {items.map((s) => (
                <button key={s.id} type="button" className="pill" disabled={pending}
                  style={{ cursor: 'pointer', background: 'var(--warm-white)' }}
                  onClick={() => act(async () => {
                    const res = await addSetting(venueId, s.id, relation);
                    if (res.ok) setAdding(null);
                    return res;
                  })}>{s.name}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const row = (l: Row) => (
    <div className="row-card" key={l.id} style={{ marginBottom: 'var(--s2)' }}>
      <header>
        <div>
          <div className="rt" style={{ fontSize: 18 }}>
            {l.venue_settings?.name}
            {l.is_primary && <span className="pill gold" style={{ marginLeft: 8 }}>Leads</span>}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
            {l.venue_settings?.category} · {l.source}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
          {l.relation === 'Immediate' && !l.is_primary && (
            <button className="link-btn" disabled={pending}
              onClick={() => act(() => saveSettingLink(l.id, venueId, 'is_primary', true))}>
              Make it lead
            </button>
          )}
          <select defaultValue={l.relation} disabled={pending}
            style={{ ...sel, width: 'auto' }}
            onChange={(e) => act(() =>
              saveSettingLink(l.id, venueId, 'relation', e.target.value))}>
            <option value="Immediate">Immediate</option>
            <option value="Reachable">Reachable</option>
          </select>
          <button className="link-btn" disabled={pending}
            onClick={() => act(() => removeSetting(l.id, venueId))}>Remove</button>
        </div>
      </header>

      <div className="grid">
        <div className="f">
          <label>In the venue&rsquo;s words</label>
          <input data-bwignore style={sel} defaultValue={l.detail ?? ''}
            placeholder={l.relation === 'Immediate'
              ? 'on a bend of the Manning River'
              : 'a twenty minute drive down the escarpment'}
            onBlur={(e) => e.target.value !== (l.detail ?? '') &&
              act(() => saveSettingLink(l.id, venueId, 'detail', e.target.value || null))} />
          <span className="help">
            Used in the listing prose ahead of the category name — always better writing
          </span>
        </div>

        {l.relation === 'Reachable' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                        gap: 'var(--s3)' }}>
            <div className="f">
              <label>Metres</label>
              <input type="number" data-bwignore style={sel} defaultValue={l.distance_m ?? ''}
                onBlur={(e) => act(() => saveSettingLink(
                  l.id, venueId, 'distance_m', e.target.value ? Number(e.target.value) : null))} />
            </div>
            <div className="f">
              <label>Minutes</label>
              <input type="number" data-bwignore style={sel} defaultValue={l.travel_minutes ?? ''}
                onBlur={(e) => act(() => saveSettingLink(
                  l.id, venueId, 'travel_minutes', e.target.value ? Number(e.target.value) : null))} />
            </div>
            <div className="f">
              <label>How it is reached</label>
              <select defaultValue={l.travel_mode ?? ''} style={sel}
                onChange={(e) => act(() =>
                  saveSettingLink(l.id, venueId, 'travel_mode', e.target.value || null))}>
                <option value="">—</option>
                {MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {msg && <div className="note bad">{msg}</div>}

      <div className="note">
        <strong>Three different statements, not three levels of importance.</strong></div>

      {prose && (
        <div className="sect">
          <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
            <div>
              <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
                How it reads
              </h3>
              <div className="ph-sub">
                {register === 'editorial'
                  ? 'On a listing, where a guest is deciding'
                  : 'On a venue profile, where a host is comparing'}
              </div>
            </div>
            <div className="ph-act">
              <button className={`btn ${register === 'editorial' ? '' : 'quiet'}`}
                onClick={() => setRegister('editorial')}>Listing</button>
              <button className={`btn ${register === 'formal' ? '' : 'quiet'}`}
                onClick={() => setRegister('formal')}>Profile</button>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', padding: 'var(--s5)' }}>
            {register === 'editorial'
              ? <SettingEditorial parts={prose as any} />
              : <SettingTechnical parts={prose as any} />}
          </div>

          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            {register === 'editorial'
              ? 'A label, a heading, a paragraph and pills. The label, heading and paragraph are a draft the listing editor replaces; the pills come from the record and keep themselves current.'
              : 'Labelled rows, exact distances, nothing implied. A host comparing four venues wants the same terms on every page.'}
          </div>
        </div>
      )}

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
              {RELATION_LABELS.operational.Immediate.heading}
            </h3>
            <div className="ph-sub">{RELATION_LABELS.operational.Immediate.blurb}</div>
          </div>
          <div className="ph-act">
            <button className="btn quiet"
              onClick={() => setAdding(adding === 'Immediate' ? null : 'Immediate')}>
              {adding === 'Immediate' ? 'Close' : 'Add'}
            </button>
          </div>
        </div>
        {adding === 'Immediate' && picker('Immediate')}
        {!immediate.length && adding !== 'Immediate' && (
          <div className="note" style={{ marginBottom: 0 }}>
            Nothing recorded. A place can be several at once — a riverside farm in a mountain
            valley is all three.
          </div>
        )}
        {immediate.map(row)}
      </div>

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
              {RELATION_LABELS.operational.Reachable.heading}
            </h3>
            <div className="ph-sub">{RELATION_LABELS.operational.Reachable.blurb}</div>
          </div>
          <div className="ph-act">
            <button className="btn quiet"
              onClick={() => setAdding(adding === 'Reachable' ? null : 'Reachable')}>
              {adding === 'Reachable' ? 'Close' : 'Add'}
            </button>
          </div>
        </div>
        {adding === 'Reachable' && picker('Reachable')}
        {reachable.map(row)}
        {!reachable.length && adding !== 'Reachable' && (
          <div className="note" style={{ marginBottom: 0 }}>
            Nothing recorded. This is where a beach twenty minutes away belongs — it is an
            amenity, not the setting.
          </div>
        )}
      </div>

      {!!inherited.length && (
        <div className="sect">
          <h3>True of the region</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Inherited from the city, and from every venue there
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {inherited.map((i) => (
              <span key={i.setting_id} className="pill"
                    style={{ borderStyle: 'dashed', color: 'var(--ink-quiet)' }}>
                {i.name}
                <span style={{ fontSize: 9, marginLeft: 5, letterSpacing: '.1em' }}>
                  {String(i.level).toUpperCase()}
                </span>
              </span>
            ))}
          </div>
          <div className="note" style={{ marginTop: 'var(--s3)', marginBottom: 0 }}>
            Set once for the city and correct for every venue in it, including ones added later.
            Change it on the city and they all change — which is why it is not edited here.
          </div>
        </div>
      )}
    </>
  );
}
