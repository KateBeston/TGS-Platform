'use client';

import { useActionState, useState } from 'react';
import { saveHostProfile, type TaxRow, type HostData } from '@/app/actions/host';

function Chip({ name, id, label, checked }: { name: string; id: number; label: string; checked: boolean }) {
  return (
    <label className="host-chip">
      <input type="checkbox" name={name} value={id} defaultChecked={checked} />
      <span>{label}</span>
    </label>
  );
}

function Group({ name, title, items, selected }: {
  name: string; title: string; items: TaxRow[]; selected: number[];
}) {
  const count = items.filter((i) => selected.includes(i.id)).length;
  const [open, setOpen] = useState(count > 0);
  return (
    <div className="host-group">
      <button type="button" className="host-group-head" onClick={() => setOpen(!open)}>
        <span className="host-group-title">{title}</span>
        <span className="host-group-meta">{count > 0 && <em>{count} selected</em>}<span className="host-group-toggle">{open ? '–' : '+'}</span></span>
      </button>
      {open && (
        <div className="host-chips">
          {items.map((i) => <Chip key={i.id} name={name} id={i.id} label={i.name} checked={selected.includes(i.id)} />)}
        </div>
      )}
    </div>
  );
}

export default function HostProfile({ data }: { data: HostData }) {
  const [state, action, pending] = useActionState(saveHostProfile, null);

  const styles = data.taxonomy.filter((t) => t.kind === 'style').sort((a, b) => a.sort_order - b.sort_order);
  const groupOf = (kind: string) => {
    const map = new Map<string, TaxRow[]>();
    data.taxonomy.filter((t) => t.kind === kind).sort((a, b) => a.sort_order - b.sort_order)
      .forEach((t) => {
        const g = t.group_name ?? 'Other';
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(t);
      });
    return [...map.entries()];
  };
  const practiceGroups = groupOf('practice');
  const amenityGroups = groupOf('amenity');

  return (
    <form action={action} className="host-profile">
      <div className="host-sec">
        <h3 className="host-sec-h">Retreat styles</h3>
        <p className="host-sec-note">The kinds of retreats you run — this helps us match you to the right venues and feeds how we understand our host community.</p>
        <div className="host-chips">
          {styles.map((s) => <Chip key={s.id} name="style" id={s.id} label={s.name} checked={data.selectedStyles.includes(s.id)} />)}
        </div>
      </div>

      <div className="host-sec">
        <h3 className="host-sec-h">What you teach</h3>
        <p className="host-sec-note">Your practices and modalities.</p>
        {practiceGroups.map(([group, items]) => (
          <Group key={group} name="practice" title={group} items={items} selected={data.selectedPractices} />
        ))}
      </div>

      <div className="host-sec">
        <h3 className="host-sec-h">Venue amenities you look for</h3>
        <p className="host-sec-note">Amenities you tend to need when sourcing a venue. We&rsquo;ll use these to surface venues that fit.</p>
        {amenityGroups.map(([group, items]) => (
          <Group key={group} name="amenity" title={group} items={items} selected={data.selectedAmenities} />
        ))}
      </div>

      <div className="acct-actions">
        <button className="acct-btn" disabled={pending}>{pending ? 'Saving…' : 'Save host profile'}</button>
        {state?.ok && <span className="acct-saved-note">Saved.</span>}
        {state?.error && <span className="acct-err">{state.error}</span>}
      </div>
    </form>
  );
}
