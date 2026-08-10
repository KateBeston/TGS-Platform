'use client';

import Link from 'next/link';
import { useState } from 'react';
import { updateListingField } from '@/app/actions/listings';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

export default function ListingEditor({
  listing, venue, types,
}: { listing: Row; venue: Row | null; types: { id: number; name: string }[] }) {
  const published = !!listing.is_published;

  return (
    <>
      <div className="ph">
        <div>
          <h2>{listing.headline ?? 'Untitled listing'}</h2>
          <div className="ph-sub">
            {listing.marketplace} marketplace · record {listing.id}
          </div>
        </div>
        <div className="ph-act">
          {published
            ? <span className="pill gold">Published</span>
            : <span className="pill empty">{listing.listing_status ?? 'Draft'}</span>}
        </div>
      </div>

      {/* Facts panel — read-only, sourced from the venue record. */}
      <div className="sect">
        <h3>Venue Record</h3>
        <div className="note" style={{ marginBottom: 'var(--s4)' }}>
          <strong>Read-only.</strong> These values are held once on the venue record and read
          from there by every listing. Edit them on the venue, not here.
        </div>
        {venue ? (
          <table>
            <tbody>
              <tr><td style={{ width: 220, color: 'var(--ink-quiet)' }}>Venue</td>
                <td><Link href={`/venues/${venue.id}/details`} style={{ color: 'var(--ink-gold)' }}>
                  {venue.venue_name}</Link></td></tr>
              <tr><td style={{ color: 'var(--ink-quiet)' }}>Location</td>
                <td>{[venue.cities?.name, venue.states?.name, venue.countries?.name]
                  .filter(Boolean).join(', ') || <span className="pill empty">Not set</span>}</td></tr>
              <tr><td style={{ color: 'var(--ink-quiet)' }}>Maximum guests</td>
                <td>{venue.max_guests ?? <span className="pill empty">Not set</span>}</td></tr>
              <tr><td style={{ color: 'var(--ink-quiet)' }}>Bedrooms</td>
                <td>{venue.total_bedrooms ?? <span className="pill empty">Not set</span>}</td></tr>
            </tbody>
          </table>
        ) : <div className="note bad">No venue linked to this listing.</div>}
      </div>

      <div className="sect">
        <h3>Editorial</h3>
        <div className="grid one">
          <LField listing={listing} column="headline" label="Headline" />
          <LField listing={listing} column="short_description" label="Short description" type="textarea"
            help="Card and search result copy" />
          <LField listing={listing} column="full_description" label="Full description" type="textarea"
            help="Listing page body copy" />
          <LField listing={listing} column="hero_image_url" label="Hero image URL" />
        </div>
      </div>

      <div className="sect">
        <h3>Search Metadata</h3>
        <div className="grid one">
          <LField listing={listing} column="meta_title" label="Meta title"
            help="Recommended pattern: Venue name – City, Country | The Global Sanctum" />
          <LField listing={listing} column="meta_description" label="Meta description" type="textarea" />
          <LField listing={listing} column="website_display_title" label="Page heading"
                  help="The H1. Need not match the venue name — say what the page is about." />
          <LField listing={listing} column="focus_keyword" label="Focus keyword"
                  help="The query this page is written for" />
          <LField listing={listing} column="social_share_image_url" label="Social share image"
                  help="Open Graph wants 1.91:1. The 16:9 hero crops badly here, and this is the one place a link is judged before it is clicked." />
          <LField listing={listing} column="canonical_override" label="Canonical override"
                  help="Leave blank unless this page genuinely duplicates another" />
          <SlugField listing={listing} />
        </div>
      </div>

      <div className="sect">
        <h3>Featured placement</h3>
        <div className="note" style={{ marginBottom: 'var(--s4)' }}>
          Drives the premium and featured sections on the home page. A date range and a rank
          rather than a single switch, so placement can be curated and can expire on its own.
        </div>
        <div className="grid">
          <LField listing={listing} column="featured_rank" label="Rank"
                  help="Lower shows first. Blank means not featured." />
          <LField listing={listing} column="featured_reason" label="Why featured"
                  help="Internal note" />
          <LDate listing={listing} column="featured_from" label="Featured from" />
          <LDate listing={listing} column="featured_until" label="Featured until" />
        </div>
      </div>

      <div className="sect">
        <h3>Classification &amp; Status</h3>
        <div className="grid">
          <LSelect listing={listing} column="venue_type_id" label="Venue type (this marketplace)"
            options={types} help="May differ from the venue record classification" />
          <LSelect listing={listing} column="listing_status" label="Listing status"
            options={['Draft','Concierge Option','Published','Unpublished'].map(s => ({ id: s, name: s }))}
            asText />
          <LBool listing={listing} column="is_published" label="Published to site"
            help="Controls public visibility. Locks the slug while true." />
          <LBool listing={listing} column="is_primary_listing" label="Primary listing"
            help="Used where a venue appears in both marketplaces" />
        </div>
      </div>
    </>
  );
}

/* ── field primitives ─────────────────────────────────────────────── */

function useCommit(listingId: number) {
  const { report } = useSaveState();
  return async (column: string, value: any, onErr: (m: string) => void) => {
    report('saving');
    const res = await updateListingField(listingId, column, value);
    if (res.ok) { onErr(''); report('saved'); return true; }
    onErr(res.error); report('error', 'Not saved');
    return false;
  };
}

function LField({
  listing, column, label, type = 'text', help,
}: { listing: Row; column: string; label: string; type?: 'text' | 'textarea'; help?: string }) {
  const commit = useCommit(listing.id);
  const original = listing[column] ?? '';
  const [value, setValue] = useState(String(original));
  const [err, setErr] = useState('');

  return (
    <div className={`f ${err ? 'bad' : ''}`}>
      <label htmlFor={column}>{label}</label>
      {type === 'textarea'
        ? <textarea data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id={column} value={value} onChange={e => setValue(e.target.value)}
            onBlur={() => value !== String(original) && commit(column, value || null, setErr)} />
        : <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id={column} value={value} onChange={e => setValue(e.target.value)}
            onBlur={() => value !== String(original) && commit(column, value || null, setErr)} />}
      {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      {help && !err && <span className="help">{help}</span>}
    </div>
  );
}

function LDate({
  listing, column, label,
}: { listing: Row; column: string; label: string }) {
  const commit = useCommit(listing.id);
  const asDate = listing[column] ? String(listing[column]).slice(0, 10) : '';
  const [v, setV] = useState(asDate);
  const [err, setErr] = useState('');
  return (
    <div className={`f ${err ? 'bad' : ''}`}>
      <label>{label}</label>
      <input type="date" data-bwignore value={v} onChange={(e) => setV(e.target.value)}
             onBlur={() => v !== asDate && commit(column, v || null, setErr)} />
      {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
    </div>
  );
}

function LSelect({
  listing, column, label, options, help, asText,
}: {
  listing: Row; column: string; label: string; help?: string; asText?: boolean;
  options: { id: number | string; name: string }[];
}) {
  const commit = useCommit(listing.id);
  const [value, setValue] = useState(listing[column] ?? '');
  const [err, setErr] = useState('');

  return (
    <div className={`f ${err ? 'bad' : ''}`}>
      <label htmlFor={column}>{label}</label>
      <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id={column} value={value ?? ''}
        onChange={e => {
          const v = e.target.value;
          setValue(v);
          commit(column, v === '' ? null : asText ? v : Number(v), setErr);
        }}>
        <option value="">Not set</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      {help && !err && <span className="help">{help}</span>}
    </div>
  );
}

function LBool({
  listing, column, label, help,
}: { listing: Row; column: string; label: string; help?: string }) {
  const commit = useCommit(listing.id);
  const [value, setValue] = useState<boolean>(!!listing[column]);
  const [err, setErr] = useState('');

  return (
    <div className={`f ${err ? 'bad' : ''}`}>
      <label>{label}</label>
      <div className="tri">
        <button type="button" className={value ? 'on' : ''}
          onClick={async () => { setValue(true); if (!await commit(column, true, setErr)) setValue(false); }}>
          Yes</button>
        <button type="button" className={!value ? 'on' : ''}
          onClick={async () => { setValue(false); if (!await commit(column, false, setErr)) setValue(true); }}>
          No</button>
      </div>
      {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      {help && !err && <span className="help">{help}</span>}
    </div>
  );
}

/** Slug is read-only by default with an explicit unlock, and the database
 *  refuses the change outright while the listing is published. Changing a
 *  live slug breaks the URL and every link pointing at it. */
function SlugField({ listing }: { listing: Row }) {
  const commit = useCommit(listing.id);
  const original = listing.slug ?? '';
  const [value, setValue] = useState(String(original));
  const [unlocked, setUnlocked] = useState(false);
  const [err, setErr] = useState('');

  return (
    <div className={`f ${err ? 'bad' : ''}`}>
      <label>
        <span>URL slug</span>
        {!unlocked && (
          <button type="button" className="link-btn" onClick={() => setUnlocked(true)}>Unlock</button>
        )}
      </label>
      <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" value={value} readOnly={!unlocked}
        style={!unlocked ? { background: 'var(--warm-cream)', color: 'var(--ink-quiet)' } : undefined}
        onChange={e => setValue(e.target.value)}
        onBlur={() => unlocked && value !== String(original) && commit('slug', value || null, setErr)} />
      {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      {!err && unlocked && (
        <span className="help" style={{ color: 'var(--warn)' }}>
          Changing a live slug breaks the existing URL and any links to it. The database will
          refuse the change while this listing is published.
        </span>
      )}
      {!err && !unlocked && <span className="help">Locked. Permanent once published.</span>}
    </div>
  );
}
