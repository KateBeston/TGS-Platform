'use client';

import Field from './Field';
import { saveVenueField } from '@/app/actions/venue-crud';
import type { Group } from '@/lib/venueSchema';

export default function VenueGroups({
  venueId, venue, groups, lookups,
}: {
  venueId: number;
  venue: Record<string, any>;
  groups: Group[];
  lookups: Record<string, { id: number | string; name: string }[]>;
}) {
  const save = async (column: string, value: unknown) => saveVenueField(venueId, column, value);

  return (
    <>
      {groups.map((g) => (
        <div className="sect" key={g.title}>
          <h3>{g.title}</h3>
          {g.note && <div className="note">{g.note}</div>}
          <div className="grid">
            {g.fields.map((f) => (
              <div key={f.col} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                <Field def={f} value={venue[f.col]} save={save}
                  options={f.lookup ? lookups[f.lookup] : undefined} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
