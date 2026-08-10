'use client';

import { useState, useTransition } from 'react';
import { SettingEditorial } from './SettingDisplay';
import { saveTabContent } from '@/app/actions/tabContent';
import { useSaveState } from './SaveState';
import type { ListingTab } from '@/lib/listingTabs';

type Row = Record<string, any> | null;
type Img = { id: number; url: string; display_url: string | null; alt_text: string | null };

export default function TabContentEditor({
  venueId, content, images, settingParts,
}: {
  venueId: number;
  tabs: ListingTab[];
  /** The recorded setting, assembled into a sentence. Offered as a
   *  starting point on the Location tab and never inserted automatically
   *  — the venue's own phrasing beats an assembled one, and an editor
   *  handed finished copy stops writing. */
  settingParts?: import('@/lib/settingProse').ProseParts | null;
  content: { tab: ListingTab; row: Row }[];
  images: Img[];
}) {
  const [open, setOpen] = useState<string | null>(content[0]?.tab.key ?? null);
  const filled = content.filter((c) => c.row?.section_title || c.row?.intro_paragraph).length;

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Listing content</h2>
          <div className="ph-sub">
            The editorial on each tab of the public listing page · {filled} of {content.length} written
          </div>
        </div>
      </div>

      <div className="note">
        <strong>This is what stops every listing reading the same.</strong> Without it each tab
        renders with generic headings and no introduction — correct, and indistinguishable from
        every other venue. A section left blank can be hidden rather than shown empty.
      </div>

      {content.map(({ tab, row }) => {
        const isOpen = open === tab.key;
        const written = !!(row?.section_title || row?.intro_paragraph);
        const hidden = row?.show_section === false;

        return (
          <div className="row-card" key={tab.key} style={{ marginBottom: 'var(--s4)' }}>
            <header>
              <div>
                <div className="rt">{tab.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>{tab.purpose}</div>
                <div style={{ fontSize: 11.5, marginTop: 4 }}>
                  {written
                    ? <span style={{ color: 'var(--ok)' }}>Written</span>
                    : <span style={{ color: 'var(--ink-quiet)' }}>Empty — will render generic</span>}
                  {hidden && <span style={{ color: 'var(--warn)' }}> · hidden on the listing</span>}
                  {row?.hero_image_url && ' · hero set'}
                </div>
              </div>
              <button className="link-btn" onClick={() => setOpen(isOpen ? null : tab.key)}>
                {isOpen ? 'Close' : 'Edit'}
              </button>
            </header>

            {isOpen && (
              <TabPanel venueId={venueId} tab={tab} row={row} images={images}
                        settingParts={settingParts} />
            )}
          </div>
        );
      })}
    </div></div>
  );
}

function TabPanel({
  venueId, tab, row, images, settingParts,
}: {
  venueId: number; tab: ListingTab; row: Row; images: Img[];
  settingParts?: import('@/lib/settingProse').ProseParts | null;
}) {
  const { report } = useSaveState();
  const [, start] = useTransition();
  const [show, setShow] = useState(row?.show_section !== false);
  const [hero, setHero] = useState<string>(row?.hero_image_url ?? '');

  const save = (column: string, value: unknown) => start(async () => {
    report('saving');
    const res = await saveTabContent(venueId, tab.key, column, value);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not saved');
    if (!res.ok) alert(res.error);
  });

  return (
    <>
      {tab.suggests && (
        <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--ink-quiet)',
                      marginBottom: 'var(--s4)' }}>
          {tab.suggests}
        </div>
      )}

      {tab.draws_from === 'setting' && settingParts && (
        <div style={{ border: '1px solid var(--border)', padding: 'var(--s5)',
                      marginBottom: 'var(--s5)', background: 'var(--warm-cream)' }}>
          <div style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
                        color: 'var(--ink-quiet)', marginBottom: 'var(--s4)' }}>
            From the setting record
          </div>
          <SettingEditorial
            parts={settingParts}
            labelOverride={row?.section_label}
            headingOverride={row?.title}
            bodyOverride={row?.body}
          />
          <div className="note" style={{ marginTop: 'var(--s5)', marginBottom: 0 }}>
            The pills come from the Setting tab and update themselves. The label, heading and
            paragraph below start from this and replace it once written — a listing that reads
            exactly like the one before it is worse than one written by hand.
          </div>
        </div>
      )}

      <div className="grid">
        <TabField label="Section label" placeholder="Small caps above the title"
          initial={row?.section_label} onSave={(v) => save('section_label', v)} />
        <TabField label="Section title" placeholder="The heading"
          initial={row?.section_title} onSave={(v) => save('section_title', v)} />
      </div>

      <div className="grid one" style={{ marginTop: 'var(--s4)' }}>
        <TabField label="Section subtitle" initial={row?.section_subtitle}
          onSave={(v) => save('section_subtitle', v)} />
        <TabField label="Introduction" type="textarea" initial={row?.intro_paragraph}
          onSave={(v) => save('intro_paragraph', v)} />
        <TabField label="Second paragraph" type="textarea" initial={row?.intro_paragraph_2}
          onSave={(v) => save('intro_paragraph_2', v)}
          help="Optional. Leave blank for a single paragraph." />
      </div>

      <div style={{ marginTop: 'var(--s5)' }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                      color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>
          Tab hero image
        </div>

        {!images.length && (
          <div className="note" style={{ marginBottom: 'var(--s3)' }}>
            No images uploaded for this venue yet. Add them on the Media tab first.
          </div>
        )}

        {!!images.length && (
          <div style={{ display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))',
                        gap: 'var(--s2)' }}>
            <button type="button"
              onClick={() => { setHero(''); save('hero_image_url', null); }}
              style={{ aspectRatio: '4/3', border: hero ? '1px solid var(--border)'
                         : '2px solid var(--gold)',
                       background: 'var(--warm-cream)', cursor: 'pointer',
                       fontSize: 11, color: 'var(--ink-quiet)' }}>
              None
            </button>
            {images.map((im) => {
              const on = hero === im.url;
              return (
                <button type="button" key={im.id}
                  onClick={() => { setHero(im.url); save('hero_image_url', im.url); }}
                  style={{ aspectRatio: '4/3', padding: 0, overflow: 'hidden', cursor: 'pointer',
                           border: on ? '2px solid var(--gold)' : '1px solid var(--border)',
                           background: 'var(--warm-cream)' }}>
                  {im.display_url
                    ? <img src={im.display_url} alt={im.alt_text ?? ''} loading="lazy"
                           style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 10 }}>No preview</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'var(--s5)', display: 'flex', alignItems: 'center',
                    gap: 'var(--s3)' }}>
        <button type="button" className={`pill ${show ? 'gold' : ''}`}
          style={{ cursor: 'pointer', background: show ? undefined : 'var(--warm-white)' }}
          onClick={() => { setShow(!show); save('show_section', !show); }}>
          {show ? 'Shown on listing' : 'Hidden'}
        </button>
        <span className="help">
          Hide a tab rather than leaving it empty — an empty section reads as unfinished.
        </span>
      </div>
    </>
  );
}

function TabField({
  label, initial, onSave, type = 'text', placeholder, help,
}: {
  label: string; initial: string | null | undefined;
  onSave: (v: string | null) => void;
  type?: 'text' | 'textarea'; placeholder?: string; help?: string;
}) {
  const [v, setV] = useState(initial ?? '');
  const commit = () => { if (v !== (initial ?? '')) onSave(v === '' ? null : v); };

  return (
    <div className="f">
      <label>{label}</label>
      {type === 'textarea'
        ? <textarea data-bwignore data-1p-ignore value={v} placeholder={placeholder}
                    onChange={(e) => setV(e.target.value)} onBlur={commit} />
        : <input data-bwignore data-1p-ignore value={v} placeholder={placeholder}
                 onChange={(e) => setV(e.target.value)} onBlur={commit} />}
      {help && <span className="help">{help}</span>}
    </div>
  );
}
