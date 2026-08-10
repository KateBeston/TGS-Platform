'use client';

import { useState } from 'react';
import type { Field as FieldDef } from '@/lib/venueSchema';
import { useSaveState } from './SaveState';
import TimeSelect from './TimeSelect';

export type Saver = (column: string, value: unknown) => Promise<{ ok: true } | { ok: false; error: string }>;

/** One renderer for every field type in the schema.
 *  Saves on blur (text, number, date) or immediately (boolean, select),
 *  because a long intake must never be able to lose work to a closed tab. */
export default function Field({
  def, value, save, options,
}: {
  def: FieldDef;
  value: unknown;
  save: Saver;
  options?: { id: number | string; name: string }[];
}) {
  const { report } = useSaveState();
  const [err, setErr] = useState('');
  const type = def.type ?? 'text';

  const toDisplay = (v: unknown) =>
    v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v);

  const [text, setText] = useState(toDisplay(value));
  const [bool, setBool] = useState<boolean | null>(
    typeof value === 'boolean' ? value : null
  );

  async function commit(out: unknown) {
    report('saving');
    const res = await save(def.col, out);
    if (res.ok) { setErr(''); report('saved'); return true; }
    setErr(res.error); report('error', 'Not saved');
    return false;
  }

  // The find / ask / calc marker used to render here. It described where a
  // value comes from when planning a venue call, which is useful in the
  // intake document and noise on a record you are simply editing.
  const label = <label htmlFor={def.col}>{def.label}</label>;
  const foot = (
    <>
      {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      {!err && def.help && <span className="help">{def.help}</span>}
    </>
  );

  /* boolean — Yes / No / Unknown, stored as true / false / null.
     Unknown is a real answer and must stay distinct from never-asked. */
  if (type === 'bool') {
    return (
      <div className={`f ${err ? 'bad' : ''}`}>
        {label}
        <div className="tri">
          <button type="button" className={bool === true ? 'on' : ''}
            onClick={async () => { const p = bool; setBool(true); if (!await commit(true)) setBool(p); }}>Yes</button>
          <button type="button" className={bool === false ? 'on' : ''}
            onClick={async () => { const p = bool; setBool(false); if (!await commit(false)) setBool(p); }}>No</button>
          <button type="button" className={bool === null ? 'on unk' : ''}
            onClick={async () => { const p = bool; setBool(null); if (!await commit(null)) setBool(p); }}>Unknown</button>
        </div>
        {foot}
      </div>
    );
  }

  /* multi — a small fixed set stored as an array.
     Rendered as explicit choices including "Both" rather than two toggles
     the user has to work out they can combine. Stored as an array either
     way, so "Both" is two entries and needs no special handling in a query
     — the same shape as venue_listings, where a venue in both marketplaces
     simply has two rows. */
  if (type === 'multi') {
    const opts = def.options ?? [];
    const chosen: string[] = text ? text.split(', ').filter(Boolean) : [];
    const isBoth = opts.length === 2 && opts.every((o) => chosen.includes(o));

    const choose = async (next: string[]) => {
      const prev = text;
      setText(next.join(', '));
      if (!(await commit(next.length ? next : null))) setText(prev);
    };

    return (
      <div className={`f ${err ? 'bad' : ''}`}>
        {label}
        <div className="tri">
          {opts.map((o) => (
            <button key={o} type="button"
              className={chosen.includes(o) && !isBoth ? 'on' : ''}
              onClick={() => choose([o])}>{o}</button>
          ))}
          {opts.length === 2 && (
            <button type="button" className={isBoth ? 'on' : ''}
                    onClick={() => choose(opts)}>Both</button>
          )}
          <button type="button" className={!chosen.length ? 'on unk' : ''}
                  onClick={() => choose([])}>Not set</button>
        </div>
        {foot}
      </div>
    );
  }

  /* time — a 15-minute dropdown rather than a native time input.
     `allowText` is on because several of these columns are text: a venue
     saying "From 2pm, earlier on request" is more useful than 14:00, and
     forcing it into a time column would discard the caveat. */
  if (type === 'time') {
    return (
      <div className={`f ${err ? 'bad' : ''}`}>
        {label}
        <TimeSelect id={def.col} value={text || null} allowText
          onChange={(v) => { setText(v ?? ''); commit(v); }} />
        {foot}
      </div>
    );
  }

  if (type === 'select') {
    const opts = options ?? (def.options ?? []).map((o) => ({ id: o, name: o }));
    const isText = !!def.options;
    return (
      <div className={`f ${err ? 'bad' : ''}`}>
        {label}
        <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id={def.col} value={text}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value === '' ? null : isText ? e.target.value : Number(e.target.value));
          }}>
          <option value="">Not set</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {foot}
      </div>
    );
  }

  const original = toDisplay(value);
  const onBlur = () => {
    if (text === original) return;
    if (type === 'num') return commit(text === '' ? null : Number(text));
    if (type === 'array') {
      const arr = text.split(',').map((s) => s.trim()).filter(Boolean);
      return commit(arr.length ? arr : null);
    }
    return commit(text === '' ? null : text);
  };

  return (
    <div className={`f ${err ? 'bad' : ''}`}>
      {label}
      {type === 'textarea'
        ? <textarea data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id={def.col} value={text} onChange={(e) => setText(e.target.value)} onBlur={onBlur} />
        : <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id={def.col} value={text} onBlur={onBlur}
            type={type === 'num' ? 'number' : type === 'date' ? 'date' : 'text'}
            step={type === 'num' ? 'any' : undefined}
            placeholder={type === 'array' ? 'Comma separated' : undefined}
            onChange={(e) => setText(e.target.value)} />}

      {/* A URL is not a picture. Any field holding an image shows one, so
          a favicon caught instead of a logo is obvious at a glance rather
          than after somebody opens the link. */}
      {/^https?:\/\//.test(text) && /logo|image|photo|avatar/.test(def.col) && (
        <div style={{ marginTop: 6, padding: 8, display: 'inline-block',
                      background: 'var(--warm-cream)',
                      border: '1px solid var(--border)' }}>
          <img src={text} alt=""
            style={{ maxHeight: 44, maxWidth: 180, objectFit: 'contain',
                     display: 'block' }}
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = 'none';
              el.parentElement?.insertAdjacentHTML('beforeend',
                '<span style="font-size:11px;color:var(--bad)">'
                + 'That link does not load</span>');
            }} />
        </div>
      )}

      {foot}
    </div>
  );
}
