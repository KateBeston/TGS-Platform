'use client';

import { useState, useTransition } from 'react';
import ContactVenues from './ContactVenues';
import Field from './Field';
import { saveContactField, setContactRole, setContactTag } from '@/app/actions/contacts';
import { useSaveState } from './SaveState';
import type { Field as FieldDef } from '@/lib/venueSchema';

type Row = Record<string, any>;

const DETAILS: FieldDef[] = [
  { col: 'entity_type', label: 'Record type', type: 'select', options: ['Person', 'Organisation'] },
  { col: 'first_name', label: 'First name', type: 'text' },
  { col: 'surname', label: 'Surname', type: 'text' },
  { col: 'organisation', label: 'Organisation', type: 'text' },
  { col: 'email', label: 'Email', type: 'text', help: 'Unique across all contacts' },
  { col: 'phone', label: 'Phone', type: 'text' },
  { col: 'whatsapp', label: 'WhatsApp', type: 'text' },
  { col: 'website_url', label: 'Website', type: 'text' },
  { col: 'preferred_contact_method', label: 'Preferred contact method', type: 'text' },
  { col: 'language', label: 'Language', type: 'text' },
  { col: 'source', label: 'Source', type: 'text', help: 'How they came to TGS' },
  { col: 'status', label: 'Status', type: 'select',
    options: ['Active', 'Inactive', 'Unsubscribed', 'Archived'] },
  { col: 'activecampaign_id', label: 'ActiveCampaign ID', type: 'text',
    help: 'Set by a sync when one exists' },
  { col: 'notes', label: 'Notes', type: 'textarea' },
];

export default function ContactRecord({
  contact, roleTypes, myRoleIds, tags, myTagIds, countries, contactVenues, searchOpts,
}: {
  contact: Row;
  roleTypes: { id: number; role_key: string; label: string; division: string | null }[];
  myRoleIds: number[];
  tags: { id: number; name: string; tag_group: string | null; is_derived: boolean }[];
  myTagIds: number[];
  countries: { id: number; name: string }[];
  contactVenues: Row[];
  searchOpts: Record<string, Row[]>;
}) {
  const { report } = useSaveState();
  const [, start] = useTransition();
  const [roles, setRoles] = useState<number[]>(myRoleIds);
  const [chosen, setChosen] = useState<number[]>(myTagIds);
  const [showAllTags, setShowAllTags] = useState(false);

  const save = (column: string, value: unknown) => saveContactField(contact.id, column, value);

  const toggleRole = (roleId: number) => start(async () => {
    const has = roles.includes(roleId);
    setRoles(has ? roles.filter((r) => r !== roleId) : [...roles, roleId]);
    report('saving');
    const res = await setContactRole(contact.id, roleId, !has);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not saved');
    if (!res.ok) setRoles(myRoleIds);
  });

  const toggleTag = (tagId: number) => start(async () => {
    const has = chosen.includes(tagId);
    setChosen(has ? chosen.filter((t) => t !== tagId) : [...chosen, tagId]);
    report('saving');
    const res = await setContactTag(contact.id, tagId, !has);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not saved');
  });

  const name = [contact.first_name, contact.surname].filter(Boolean).join(' ')
    || contact.organisation || 'Unnamed contact';

  // Roles grouped by division so the list reads as the business does
  const byDivision = roleTypes.reduce<Record<string, typeof roleTypes>>((a, r) => {
    (a[r.division ?? 'Other'] ||= []).push(r); return a;
  }, {});

  const tagGroups = tags.reduce<Record<string, typeof tags>>((a, t) => {
    (a[t.tag_group ?? 'Other'] ||= []).push(t); return a;
  }, {});
  const visibleGroups = showAllTags
    ? Object.entries(tagGroups)
    : Object.entries(tagGroups).filter(([, items]) =>
        items.some((t) => chosen.includes(t.id)));

  return (
    <>
      <div className="ph">
        <div>
          <h2>{name}</h2>
          <div className="ph-sub">
            {contact.entity_type} · record {contact.id}
            {contact.email && ` · ${contact.email}`}
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Roles</h3>
        <div className="note">
          What this contact is to the business. More than one is normal — a venue owner
          who also hosts retreats holds both.
        </div>
        {Object.entries(byDivision).map(([division, items]) => (
          <div key={division} style={{ marginBottom: 'var(--s4)' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                          color: 'var(--ink-quiet)', marginBottom: 6 }}>{division}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map((r) => {
                const on = roles.includes(r.id);
                return (
                  <button key={r.id} className={`pill ${on ? 'gold' : ''}`}
                    style={{ cursor: 'pointer', background: on ? undefined : 'var(--warm-white)' }}
                    onClick={() => toggleRole(r.id)}>{r.label}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sect">
        <h3>Details</h3>
        <div className="grid">
          {DETAILS.map((f) => (
            <div key={f.col} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
              <Field def={f} value={contact[f.col]} save={save} />
            </div>
          ))}
          <Field def={{ col: 'country_id', label: 'Country', type: 'select' }}
                 value={contact.country_id} save={save} options={countries} />
        </div>
      </div>

      <ContactVenues contactId={contact.id} rows={contactVenues} options={searchOpts} />

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Tags</h3>
            <div className="ph-sub">{chosen.length} applied</div>
          </div>
          <div className="ph-act">
            <button className="btn quiet" onClick={() => setShowAllTags(!showAllTags)}>
              {showAllTags ? 'Show applied only' : 'Show all tags'}
            </button>
          </div>
        </div>

        <div className="note">
          Tags marked <em>derived</em> are intended to be set from the database once a sync
          exists — subscription tier, venue category, payment state. Setting one by hand here
          records it, but it is not yet connected to anything.
        </div>

        {!visibleGroups.length && (
          <div className="note">No tags applied. Choose "Show all tags" to add one.</div>
        )}

        {visibleGroups.map(([group, items]) => (
          <div key={group} style={{ marginBottom: 'var(--s4)' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                          color: 'var(--ink-quiet)', marginBottom: 6 }}>{group}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items
                .filter((t) => showAllTags || chosen.includes(t.id))
                .map((t) => {
                  const on = chosen.includes(t.id);
                  return (
                    <button key={t.id} className={`pill ${on ? 'gold' : ''}`}
                      title={t.is_derived ? 'Derived — intended to be set from the database' : undefined}
                      style={{ cursor: 'pointer',
                               background: on ? undefined : 'var(--warm-white)',
                               borderStyle: t.is_derived ? 'dashed' : 'solid' }}
                      onClick={() => toggleTag(t.id)}>{t.name}</button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
