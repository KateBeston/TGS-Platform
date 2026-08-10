'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createBlankVenue } from '@/app/actions/venues';
import {
  acceptDraft, discardDraft, findLocations, matchDraftServices, readAndCreate,
  readBrandLocations, readVenueFromUrl, refreshLinks, updateDraftField,
  updateDraftService,
} from '@/app/actions/venueIntake';
import { createPractice, suggestPractice } from '@/app/actions/practiceCandidates';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', width: '100%', fontSize: 13.5,
};

/* ═══════════════════════════════════════════════════════════════════════
   ADD A VENUE

   Three ways in, one outcome.

   From a URL: the site is read — home page plus whatever it links to for
   accommodation, rates, spaces, services and terms — and a complete draft
   comes back, child records included. Nothing is written until it has
   been looked at.

   From pasted text: for Facebook and Instagram, which return a login wall
   to anything automated. Copying the About section works today and needs
   nothing built.

   By hand: a blank record.
   ═══════════════════════════════════════════════════════════════════════ */

export default function AddVenue({
  draft, recent, practices, categories, group,
}: {
  /** A chain URL carried over from a preview, so pressing "read them as
   *  a group" starts the group flow with the address already in it. */
  group?: string | null; draft: Row | null; recent: Row[]; practices: Row[]; categories: Row[] }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<'url' | 'paste' | 'manual'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [groupWarning, setGroupWarning] = useState<number | null>(null);

  // Arrived from a preview that turned out to be a chain. The locations
  // are looked for straight away rather than making somebody paste the
  // address a second time.
  useEffect(() => {
    if (!group) return;
    setUrl(group);
    act(async () => {
      const r = await findLocations(group);
      if (r.ok && (r as any).locations) setLocations((r as any).locations);
      return r;
    });
  }, [group]);
  const [chosenLocations, setChosenLocations] = useState<Set<string>>(new Set());
  const [brandName, setBrandName] = useState('');
  const [manualName, setManualName] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? '') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    return res;
  });

  /** Reads the site and lands in the venue record. The venue profile is
   *  where work happens; this screen only gets it there. */
  /** Looks for other locations first. A brand's home page describes the
   *  brand, not a venue — reading it alone records an ethos with no
   *  address, and creates one record where there should be eight. */
  const checkLocations = () => act(async () => {
    setLocations([]);
    const r = await findLocations(url);
    if (r.ok && r.locations.length) {
      setLocations(r.locations);
      setChosenLocations(new Set(
        r.locations.filter((l: any) => !l.existing).map((l: any) => l.url)));
      return { ok: true, message:
        `${r.locations.length} location${r.locations.length === 1 ? '' : 's'} found.` };
    }
    return r.ok
      ? { ok: true, message: 'No other locations found — reading this as a single venue.' }
      : r;
  });

  const create = (force = false) => act(async () => {
    setDuplicates([]);
    const r = await readAndCreate(url, mode === 'paste' ? text : undefined, force);

    // Caught before navigating away. Pasting aman.com and getting one
    // venue called Aman is a mistake nobody notices until thirty-four
    // records are missing — so the question is asked while somebody is
    // still looking at it.
    const found = (r as any).possibleLocations;
    if (r.ok && found?.length >= 3) {
      setLocations(found);
      setGroupWarning(found.length);
      return r;
    }

    if (r.ok && (r as any).venueId) {
      router.push(`/venues/${(r as any).venueId}/details?from=intake`);
    }
    // Not an error so much as a question — the venue may already be here.
    if (!r.ok && (r as any).duplicates?.length) {
      setDuplicates((r as any).duplicates);
    }
    return r;
  });

  if (draft?.payload) {
    return <DraftReview draft={draft} practices={practices} categories={categories} />;
  }

  return (
    <>
      <div className="ph">
        <div>
          <h2>Add a venue</h2>
          <div className="ph-sub">From a website, from pasted text, or by hand</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--s3)', marginBottom: 'var(--s5)' }}>
        {([['url', 'From a website'], ['paste', 'From pasted text'],
           ['manual', 'By hand']] as const).map(([k, label]) => (
          <button key={k} className={`btn ${mode === k ? '' : 'quiet'}`}
            onClick={() => setMode(k)}>{label}</button>
        ))}
      </div>

      {mode === 'url' && (
        <div className="sect">
          <h3>Read their website</h3>
          <div className="note">
            The home page is read, then whatever it links to for accommodation, rates, spaces,
            services and terms — up to six pages. A home page rarely states capacity; an
            accommodation page always does.</div>

          <div className="f" style={{ maxWidth: 620 }}>
            <label htmlFor="u">Their web address</label>
            <input id="u" data-bwignore value={url} style={sel}
              placeholder="curraweenahouse.com.au"
              onKeyDown={(e) => e.key === 'Enter' && url.trim() && create()}
              onChange={(e) => setUrl(e.target.value)} />
            <span className="help">Their own site, not a listing on somebody else&rsquo;s</span>
          </div>

          {/* One button, one intention. Three of them asked somebody to
              decide something they could not know yet — whether the site
              has several locations is a question the read answers, not
              one to be asked beforehand. */}
          <div style={{ marginTop: 'var(--s3)' }}>
            <button className="btn" disabled={pending || !url.trim()}
              onClick={() => act(async () => {
                const r = await readVenueFromUrl(url);
                if (r.ok && r.draftId) router.push(`/venues/new?draft=${r.draftId}`);
                return r;
              })}>
              {pending ? 'Reading the site…' : 'Read their site'}
            </button>
          </div>

          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            Nothing is created yet. The read produces a preview to look over, and the venue is
            made when you say so — which is also where a site turning out to have several
            locations gets caught.
          </div>

          {msg && <div className="note bad" style={{ marginTop: 'var(--s4)' }}>{msg}</div>}
          <DuplicateWarning duplicates={duplicates} pending={pending}
                            onProceed={() => create(true)} />

          {groupWarning && (
            <div className="note">
              <strong>That site has {groupWarning} locations on it.</strong> Each is its own
              venue with its own services, prices and listing — a group read creates them all
              and ties them to one brand. Reading it as a single venue would describe the brand
              rather than any of the places.
            </div>
          )}

          {!!locations.length && (
            <BrandLocations
              locations={locations}
              chosen={chosenLocations}
              onToggle={(u) => {
                const next = new Set(chosenLocations);
                next.has(u) ? next.delete(u) : next.add(u);
                setChosenLocations(next);
              }}
              brandName={brandName}
              onBrandName={setBrandName}
              pending={pending}
              onRead={() => act(async () => {
                const r = await readBrandLocations(
                  url, Array.from(chosenLocations), brandName);
                if (r.ok) { setLocations([]); router.push('/venues'); }
                return r;
              })}
            />
          )}
        </div>
      )}

      {mode === 'paste' && (
        <div className="sect">
          <h3>From pasted text</h3>
          <div className="note">
            <strong>For Facebook and Instagram.</strong> Both return a login wall to anything
            automated, so a pasted link alone gives nothing. Copy the About section and a few posts
            and paste them here — it reads them the same way.</div>

          <div className="f" style={{ maxWidth: 620 }}>
            <label htmlFor="pu">Their address, if you have one</label>
            <input id="pu" data-bwignore value={url} style={sel}
              placeholder="instagram.com/theirvenue"
              onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="f" style={{ marginTop: 'var(--s3)' }}>
            <label htmlFor="pt">Paste the page content here</label>
            <textarea id="pt" data-bwignore value={text}
              style={{ ...sel, minHeight: 220 }}
              placeholder="Their bio, About section, a few posts — anything describing the venue"
              onChange={(e) => setText(e.target.value)} />
          </div>

          <button className="btn" disabled={pending || !text.trim()}
            style={{ marginTop: 'var(--s3)' }}
            onClick={() => act(async () => {
              const r = await readVenueFromUrl(url || 'pasted', text);
              if (r.ok && r.draftId) router.push(`/venues/new?draft=${r.draftId}`);
              return r;
            })}>
            {pending ? 'Reading…' : 'Read what I pasted'}
          </button>

          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            Nothing is created yet — the read produces a preview to look over first.
          </div>

          {msg && <div className="note bad" style={{ marginTop: 'var(--s4)' }}>{msg}</div>}
        </div>
      )}

      {mode === 'manual' && (
        <div className="sect">
          <h3>By hand</h3>
          <div className="note">
            A blank record with a name, filled in from the venue tabs. Use this when there is no
            site to read, or when you already hold the details.</div>

          <div className="f" style={{ maxWidth: 420 }}>
            <label htmlFor="manual-name">Venue name</label>
            <input id="manual-name" data-bwignore value={manualName} style={sel}
              placeholder="As the venue writes it"
              onChange={(e) => setManualName(e.target.value)} />
          </div>

          <button className="btn" disabled={pending || !manualName.trim()}
            style={{ marginTop: 'var(--s3)' }}
            onClick={() => act(async () => {
              const res = await createBlankVenue(manualName);
              if (res.ok && (res as any).venueId) {
                router.push(`/venues/${(res as any).venueId}/details`);
              }
              return res;
            })}>
            {pending ? 'Creating…' : 'Create the record'}
          </button>

          {msg && <div className="note bad" style={{ marginTop: 'var(--s4)' }}>{msg}</div>}
        </div>
      )}

      {!!recent.length && (
        <div className="sect">
          <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
            <div>
              <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
                Drafts waiting
              </h3>
              <div className="ph-sub">
                Opening one costs nothing — the reading was paid for once
              </div>
            </div>
            <div className="ph-act">
              <Link className="btn quiet" href="/venues/intake">Every read</Link>
            </div>
          </div>
          <table>
            <thead><tr><th>Read from</th><th>Name found</th><th>When</th><th>Cost</th><th></th></tr></thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.id}>
                  <td className="v-slug" style={{ maxWidth: 300, wordBreak: 'break-word' }}>
                    <a href={d.source_url} target="_blank" rel="noopener"
                       style={{ wordBreak: 'break-all' }}>
                      {String(d.source_url ?? '').replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                    {d.status === 'Failed' && (
                      <div style={{ color: 'var(--bad)', marginTop: 4, lineHeight: 1.5 }}>
                        {d.error_message}
                      </div>
                    )}
                    {!!(d.pages_read ?? []).length && (
                      <div style={{ marginTop: 3 }}>
                        {d.pages_read.length} page{d.pages_read.length === 1 ? '' : 's'} read
                        {d.input_tokens
                          ? ` · ${(d.input_tokens / 1000).toFixed(1)}k in, ${d.output_tokens} out`
                          : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="v-name" style={{ fontSize: 16 }}>
                      {(d.payload as any)?.venue_name ?? '—'}
                    </span>
                  </td>
                  <td className="v-slug">
                    {new Date(d.created_at).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="v-slug">
                    {d.cost_usd ? `$${Number(d.cost_usd).toFixed(3)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {d.status === 'Ready' && (
                      <Link className="btn quiet" href={`/venues/new?draft=${d.id}`}>Check it</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ── reviewing what came back ────────────────────────────────────── */

function DraftReview({
  draft, practices, categories,
}: { draft: Row; practices: Row[]; categories: Row[] }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  // Not typed into, but actions on this screen — refreshing the links,
  // matching services — change what the read found, and the preview
  // should show that rather than the answer it opened with.
  const [p, setP] = useState<any>(draft.payload);
  const [msg, setMsg] = useState('');

  const locations = (draft.possible_locations ?? []) as { url: string; label: string }[];
  const isAGroup = locations.length >= 3;

  /* Shown, not edited. A preview that can be changed is two places to
     edit the same venue, and somebody eventually corrects a name here and
     again in the record and wonders why they disagree.

     Everything is editable the moment the venue exists, against all 451
     fields rather than the dozen a draft carries. */
  const F = ({ label, k, help, wide }: {
    label: string; k: string; help?: string; wide?: boolean;
  }) => {
    const value = p[k];
    const empty = value === null || value === undefined || value === '';

    return (
      <div className="f" style={wide ? { gridColumn: '1 / -1' } : undefined}>
        <label>{label}</label>
        <div style={{
          padding: '8px 10px', fontSize: 13.5, minHeight: 36,
          background: 'var(--warm-cream)',
          border: '1px solid var(--border)',
          color: empty ? 'var(--muted)' : 'var(--charcoal)',
          whiteSpace: wide ? 'pre-wrap' : undefined,
        }}>
          {empty ? 'Not found' : String(value)}
        </div>
        {help && <span className="help">{help}</span>}
      </div>
    );
  };

  const counts = [
    ['rooms', p.room_types?.length ?? 0],
    ['spaces', p.spaces?.length ?? 0],
    ['services', p.services?.length ?? 0],
    ['policies', p.policies?.length ?? 0],
  ] as const;

  return (
    <>
      <div className="ph">
        <div>
          <h2>{p.venue_name ?? 'Unnamed'}</h2>
          <div className="ph-sub">
            {(draft.pages_read ?? []).length} pages read
            {!!(draft.pages_failed ?? []).length &&
              ` · ${draft.pages_failed.length} unreachable`}
            {draft.cost_usd && ` · $${Number(draft.cost_usd).toFixed(3)}`}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" disabled={pending}
            onClick={() => start(async () => {
              await discardDraft(draft.id);
              router.push('/venues/new');
            })}>Discard</button>
          <button className="btn" disabled={pending || !p.venue_name || isAGroup}
            onClick={() => start(async () => {
              report('saving');
              const res = await acceptDraft(draft.id);
              if (res.ok && res.venueId) router.push(`/venues/${res.venueId}/details`);
              else { setMsg((res as any).error); report('error', 'Failed'); }
            })}>
            {pending ? 'Creating…' : 'Create the venue'}
          </button>
        </div>
      </div>

      {/* Caught here rather than beforehand, because whether a site has
          several locations is something the read answers — not something
          somebody could know before pressing the button. */}
      {isAGroup && (
        <div className="note bad">
          <strong>This site has {locations.length} locations on it.</strong> Creating one venue
          would describe the brand rather than any of the places — each has its own services,
          prices and listing.
          <div style={{ marginTop: 'var(--s3)' }}>
            <Link className="btn" href={`/venues/new?group=${encodeURIComponent(draft.source_url)}`}>
              Read them as a group instead
            </Link>
          </div>
        </div>
      )}

      {msg && <div className="note bad">{msg}</div>}

      <div className="note">
        <strong>This is the check-before-creating view.</strong> Correct anything obviously wrong,
        then create it — after that the venue record itself is where you work, with every tab and
        every field. Nothing here is a substitute for that.
      </div>

      {!!(p.flags ?? []).length && (
        <div className="note bad">
          <strong>Worth checking:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {p.flags.map((f: string, i: number) => (
              <li key={i} style={{ marginBottom: 4 }}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {p.name_note && (
        <div className="note">
          <strong>On the name:</strong> {p.name_note} — the name is recorded exactly as their site
          writes it, accents and all. Correct it above if it is wrong.
        </div>
      )}

      <div className="stats">
        {counts.map(([label, n]) => (
          <div className="stat" key={label}>
            <div className={`v ${n ? '' : 'zero'}`}>{n}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      <div className="sect">
        <h3>The venue</h3>
        <div className="grid">
          <F label="Name" k="venue_name"
             help="Exactly as their site writes it — accents and ampersands included" />
          <F label="Type" k="venue_type" />
          <F label="Setting, in their words" k="setting_headline" />
          <F label="Website" k="website_url" />
          <F label="Description" k="venue_short_description" wide />
        </div>
      </div>

      <div className="sect">
        <h3>Where it is</h3>
        <div className="grid">
          <F label="Street address" k="street_address" />
          <F label="City" k="city" help="Matched to a known city on save" />
          <F label="State or region" k="state" />
          <F label="Country" k="country" />
          <F label="Postcode" k="postcode" />
        </div>
      </div>

      <div className="sect">
        <h3>Contact</h3>
        <div className="grid">
          <F label="Phone" k="contact_phone" />
          <F label="Email" k="contact_email" />
          <F label="WhatsApp" k="whatsapp_number" />
          <F label="Booking engine" k="booking_engine_url"
             help="Which platform they run on. Matters later for availability sync — Cloudbeds, Siteminder and Mews expose calendars differently." />
        </div>
      </div>

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Their links</h3>
            <div className="ph-sub">
              Read from the page rather than written by the model — a URL in the markup is already
              correct
            </div>
          </div>
          <div className="ph-act">
            <button className="btn quiet" disabled={pending}
              onClick={() => start(async () => {
                report('saving');
                const res = await refreshLinks({ draftId: draft.id });
                setMsg(res.ok ? (res.message ?? '') : (res as any).error);
                report(res.ok ? 'saved' : 'error');
                // Merged into local state rather than relying on a
                // refresh: refresh re-fetches the server data, but React
                // preserves component state, so the fields would stay as
                // they were and the links would look like they had not
                // saved when in fact they had.
                if (res.ok && (res as any).fields) {
                  setP({ ...p, ...(res as any).fields });
                }
              })}>
              {pending ? 'Reading…' : 'Find their links'}
            </button>
          </div>
        </div>
        <div className="note">
          <strong>Costs nothing.</strong> The links are in the markup and fetching a page is free.
          Use this on anything read before link extraction existed.
        </div>
        <div className="grid">
          <F label="Instagram" k="instagram_url" />
          <F label="Facebook" k="facebook_url" />
          <F label="YouTube" k="youtube_url" />
          <F label="TikTok" k="tiktok_url" />
          <F label="LinkedIn" k="linkedin_url" />
          <F label="Pinterest" k="pinterest_url" />
          <F label="TripAdvisor" k="tripadvisor_url" help="Their existing reviews" />
          <F label="Google" k="google_business_url" />
        </div>
        {!!p.other_links?.length && (
          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            <strong>Also linked:</strong>{' '}
            {p.other_links.map((o: any) => o.label).join(', ')} — kept against the venue, since a
            platform without a field of its own is still where some of their guests are.
            {p.other_links.some((o: any) => o.label === 'Listed elsewhere') && (
              <> <br /><br />Listed on another marketplace, which is useful to know: a venue
              already working with third-party distribution understands commission, and that is a
              shorter conversation than one starting from scratch.</>
            )}
          </div>
        )}
      </div>

      <div className="sect">
        <h3>Capacity</h3>
        <div className="grid">
          <F label="Maximum guests" k="max_guests" help="Overnight, not seated" />
          <F label="Bedrooms" k="total_bedrooms" />
          <F label="Bathrooms" k="total_bathrooms" />
          <F label="From price" k="price_from" />
          <F label="Currency" k="price_currency" />
          <F label="Established" k="established_year" />
        </div>
      </div>

      {!!p.room_types?.length && (
        <div className="sect">
          <h3>Rooms</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Beds counted, not described — so a search can answer &ldquo;twelve, nobody
            sharing&rdquo;
          </div>
          {p.room_types.map((r: any, i: number) => (
            <div className="row-card" key={i} style={{ marginBottom: 'var(--s3)' }}>
              <header>
                <div>
                  <div className="rt" style={{ fontSize: 19 }}>
                    {r.name}
                    {r.quantity > 1 && (
                      <span style={{ fontFamily: 'var(--sans)', fontSize: 13,
                                     color: 'var(--ink-quiet)' }}> × {r.quantity}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
                    {[r.sleeps && `sleeps ${r.sleeps}`, r.bathroom_type, r.outlook,
                      r.room_size && `${r.room_size} ${r.room_size_unit ?? 'm²'}`]
                      .filter(Boolean).join(' · ')}
                  </div>
                </div>
                {r.image_url && (
                  <a className="link-btn" href={r.image_url} target="_blank" rel="noopener">
                    Image
                  </a>
                )}
              </header>

              {r.description && (
                <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 var(--s3)',
                            maxWidth: '68ch' }}>{r.description}</p>
              )}

              {/* Groups are alternatives, not additions. A room offering
                  a king OR two singles is one room, two ways. */}
              {!!(r.beds ?? []).length && (
                <div style={{ marginBottom: 'var(--s3)' }}>
                  <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                                color: 'var(--ink-quiet)', marginBottom: 4 }}>Beds</div>
                  {Object.entries(
                    (r.beds as any[]).reduce((acc: Record<string, any[]>, b: any) => {
                      const g = String(b.group ?? 1);
                      (acc[g] ||= []).push(b);
                      return acc;
                    }, {}),
                  ).map(([group, beds], gi) => (
                    <div key={group} style={{ fontSize: 13.5, marginBottom: 2 }}>
                      {gi > 0 && (
                        <span style={{ color: 'var(--ink-gold)', fontStyle: 'italic' }}>or </span>
                      )}
                      {(beds as any[]).map((b) =>
                        `${b.quantity ?? 1} × ${String(b.type ?? '').replace(/-/g, ' ')}`)
                        .join(' and ')}
                    </div>
                  ))}
                  {r.bed_configuration && (
                    <div className="v-slug" style={{ marginTop: 3 }}>
                      As written: {r.bed_configuration}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                            gap: 'var(--s3) var(--s4)' }}>
                {!!(r.in_room_amenities ?? []).length && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                                  color: 'var(--ink-quiet)', marginBottom: 4 }}>In the room</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.in_room_amenities.map((a: string, j: number) => (
                        <span key={j} className="pill" style={{ fontSize: 10 }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {!!(r.in_room_services ?? []).length && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                                  color: 'var(--ink-quiet)', marginBottom: 4 }}>
                      Available in the room
                    </div>
                    <div style={{ fontSize: 13 }}>{r.in_room_services.join(' · ')}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="note" style={{ marginBottom: 0 }}>
            <strong>Amenities are matched against the catalogue on save.</strong> Anything not
            recognised is dropped rather than added as a new item — a catalogue that grows itself
            from scraped text stops being one, and then nothing can be filtered on.
          </div>
        </div>
      )}
      {!!p.spaces?.length && (
        <div className="sect">
          <h3>Spaces</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            What a listing shows: a name, a description, an image, and the figures beneath it
          </div>
          {p.spaces.map((sp: any, i: number) => (
            <div className="row-card" key={i} style={{ marginBottom: 'var(--s3)' }}>
              <header>
                <div>
                  <div className="rt" style={{ fontSize: 20 }}>{sp.name}</div>
                  {sp.space_type && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
                      {sp.space_type}
                      {sp.is_indoor === false && ' · outdoor'}
                      {sp.is_covered && ' · covered'}
                    </div>
                  )}
                </div>
                {sp.image_url && (
                  <a className="link-btn" href={sp.image_url} target="_blank" rel="noopener">
                    Image
                  </a>
                )}
              </header>

              {sp.description && (
                <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 var(--s3)',
                            maxWidth: '68ch' }}>{sp.description}</p>
              )}

              {/* The stat bar, as it would appear on the listing. */}
              {!!(sp.capacities ?? []).length && (
                <div style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap',
                              paddingBottom: 'var(--s3)', marginBottom: 'var(--s3)',
                              borderBottom: '1px solid var(--border)' }}>
                  {sp.capacities.map((c: any, j: number) => (
                    <div key={j}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1 }}>
                        {c.capacity}
                      </div>
                      <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
                                    color: 'var(--ink-quiet)', marginTop: 4 }}>
                        {String(c.usage ?? '').replace(/-/g, ' ')}
                      </div>
                    </div>
                  ))}
                  {sp.area && (
                    <div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1 }}>
                        {sp.area}
                      </div>
                      <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
                                    color: 'var(--ink-quiet)', marginTop: 4 }}>
                        {sp.area_unit ?? 'm²'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                            gap: 'var(--s3) var(--s4)' }}>
                {([
                  ['Flooring', sp.flooring], ['Climate', sp.climate_control],
                  ['Lighting', sp.lighting], ['Acoustics', sp.acoustics],
                  ['View', sp.view_type], ['Outlook', sp.outlook],
                  ['Equipment', sp.equipment_provided], ['Suitable for', sp.suitable_for],
                ] as [string, string | null][]).filter(([, v]) => v).map(([label, v]) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                                  color: 'var(--ink-quiet)' }}>{label}</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!!p.services?.length && (
        <DraftServices
          draftId={draft.id}
          services={p.services}
          practices={practices}
          categories={categories}
          defaultCurrency={p.price_currency}
          onChange={(services) => setP({ ...p, services })}
        />
      )}
      {!!p.facilities?.length && (
        <div className="sect">
          <h3>Facilities</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            As their site writes them. Matched against the catalogue when you create the venue —
            anything unrecognised goes to Settings for a decision rather than being dropped.
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {p.facilities.map((f: string, i: number) => (
              <span key={i} className="pill" style={{ fontSize: 11 }}>{f}</span>
            ))}
          </div>
          <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
            <strong>Not tidied on purpose.</strong> A meditation cave in rural Mexico is exactly
            the thing worth recording, and exactly the thing a standardised phrase would lose.
          </div>
        </div>
      )}

      {!!p.policies?.length && (
        <div className="sect">
          <h3>Their policies</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Kept as their document, not as a TGS one — we do not version it and nobody accepts it
            through us
          </div>
          {p.policies.map((pol: any, i: number) => (
            <div key={i} style={{ marginBottom: 'var(--s4)' }}>
              <div className="v-name" style={{ fontSize: 16 }}>{pol.type}</div>
              <div className="v-slug" style={{ marginTop: 4, lineHeight: 1.6, maxWidth: '70ch' }}>
                {pol.text}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sect">
        <h3>Read from</h3>
        <ul className="doc-list" style={{ paddingLeft: 18 }}>
          {(draft.pages_read ?? []).map((u: string) => (
            <li key={u} className="v-slug" style={{ wordBreak: 'break-all' }}>{u}</li>
          ))}
          {(draft.pages_failed ?? []).map((u: string) => (
            <li key={u} className="v-slug"
                style={{ wordBreak: 'break-all', color: 'var(--warn)' }}>
              {u} — could not be read
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function ChildList({ title, rows, cols }: { title: string; rows: any[]; cols: string[] }) {
  return (
    <div className="sect">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>{cols.map((c) => (
            <th key={c}>{c.replace(/_/g, ' ')}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} className={c === 'name' ? undefined : 'v-slug'}>
                  {c === 'name'
                    ? <span className="v-name" style={{ fontSize: 16 }}>{r[c]}</span>
                    : (r[c] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── services on a draft ─────────────────────────────────────────── */

/** Editable, and matched to the taxonomy.
 *
 *  A draft read before the taxonomy was wired in carries a loose category
 *  like "massage" or "spa treatment", which matches nothing. And a site
 *  that publishes its prices on a page the crawl did not reach leaves
 *  duration and price empty — which should be typeable rather than a
 *  reason to pay for another read.
 */
function DraftServices({
  draftId, services, practices, categories, defaultCurrency, onChange,
}: {
  draftId: number;
  services: any[];
  practices: Row[];
  categories: Row[];
  defaultCurrency?: string | null;
  onChange: (services: any[]) => void;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const save = (index: number, field: string, value: unknown) => start(async () => {
    report('saving');
    const res = await updateDraftService(draftId, index, field, value);
    report(res.ok ? 'saved' : 'error');
    if (res.ok && (res as any).fields?.services) {
      onChange((res as any).fields.services);
    }
  });

  const matched = services.filter((s) => s.practice_id).length;

  const cell: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '5px 7px', fontSize: 12.5, width: '100%',
  };

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
            Wellness services
          </h3>
          <div className="ph-sub">
            {matched} of {services.length} matched to a practice
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" disabled={pending}
            onClick={() => start(async () => {
              report('saving');
              const res = await matchDraftServices(draftId);
              setMsg(res.ok ? (res.message ?? '') : (res as any).error);
              report(res.ok ? 'saved' : 'error');
              if (res.ok && (res as any).fields?.services) {
                onChange((res as any).fields.services);
              }
            })}>
            {pending ? 'Matching…' : 'Match to practices'}
          </button>
        </div>
      </div>

      <div className="note">
        <strong>Everything here is editable before the venue is created.</strong> A site that
        publishes its prices on a page the crawl did not reach leaves duration and price empty —
        type them rather than paying for another read.</div>

      {msg && <div className="note">{msg}</div>}

      <table>
        <thead>
          <tr>
            <th style={{ width: '34%' }}>Their name, and what it is</th>
            <th style={{ width: 90 }}>Minutes</th>
            <th style={{ width: 120 }}>Price</th>
            <th style={{ width: 80 }}>Currency</th>
            <th style={{ width: 55 }}>From</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s, i) => (
            <ServiceRow key={i} index={i} service={s} practices={practices}
              categories={categories} defaultCurrency={defaultCurrency}
              pending={pending} onSave={save} onChange={onChange}
              draftId={draftId} />
          ))}
        </tbody>
      </table>

      <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
        <strong>Unmatched is a fine answer.</strong> A service with no practice is still recorded —
        it simply cannot be searched on by modality.</div>
    </div>
  );
}

/** One service: the venue's own name on top, what it is beneath.
 *
 *  Their name is primary because it is what identifies the thing. Udara
 *  lists four massages, and "Body Therapies · Massage" on all four tells
 *  you nothing about which is which — but "Balinese Massage" over
 *  "Body Therapies · Balinese Massage" does.
 */
function ServiceRow({
  index, service, practices, categories, defaultCurrency,
  pending, onSave, onChange, draftId,
}: {
  index: number;
  service: any;
  practices: Row[];
  categories: Row[];
  defaultCurrency?: string | null;
  pending: boolean;
  onSave: (i: number, field: string, value: unknown) => void;
  onChange: (services: any[]) => void;
  draftId: number;
}) {
  const { report } = useSaveState();
  const [busy, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [newName, setNewName] = useState(service.name ?? '');
  const [newCategory, setNewCategory] = useState<number | ''>('');

  const cell: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '5px 7px', fontSize: 12.5, width: '100%',
  };

  const openAdd = () => {
    setAdding(true);
    setNewName(service.practice ?? service.name ?? '');
    start(async () => {
      const hits = await suggestPractice(service.name ?? '');
      setSuggestions(hits);
      // Where the category is obvious from the wording, choose it. That
      // is usually the only decision left.
      const first = hits.find((h: any) => h.categoryId);
      if (first) setNewCategory(first.categoryId);
    });
  };

  return (
    <>
      <tr>
        <td>
          {/* Theirs, primary. */}
          <span className="v-name" style={{ fontSize: 15 }}>{service.name}</span>

          {/* What it is, beneath. */}
          <div style={{ marginTop: 4 }}>
            <select value={service.practice_id ?? ''} style={{ ...cell, fontSize: 11.5 }}
              disabled={pending || busy}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                const chosen = practices.find((pr) => pr.id === id);
                onSave(index, 'practice', chosen?.name ?? null);
              }}>
              <option value="">
                {service.category
                  ? `not matched — their site says "${service.category}"`
                  : 'not matched'}
              </option>
              {practices.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {(pr as any).category} · {pr.name}
                </option>
              ))}
            </select>
          </div>

          {!service.practice_id && !adding && (
            <button className="link-btn" style={{ fontSize: 11, marginTop: 3 }}
              onClick={openAdd}>
              Not in the list — suggest one
            </button>
          )}

          {service.description && (
            <div className="v-slug" style={{ maxWidth: 300, marginTop: 4 }}>
              {String(service.description).slice(0, 110)}
            </div>
          )}
        </td>

        <td>
          <input type="number" data-bwignore style={cell}
            defaultValue={service.duration_minutes ?? ''} placeholder="—"
            onBlur={(e) => e.target.value !== String(service.duration_minutes ?? '') &&
              onSave(index, 'duration_minutes',
                e.target.value ? Number(e.target.value) : null)} />
        </td>
        <td>
          <input type="number" data-bwignore style={cell}
            defaultValue={service.price ?? ''} placeholder="—"
            onBlur={(e) => e.target.value !== String(service.price ?? '') &&
              onSave(index, 'price', e.target.value ? Number(e.target.value) : null)} />
        </td>
        <td>
          <input data-bwignore style={cell}
            defaultValue={service.currency ?? defaultCurrency ?? ''} placeholder="—"
            onBlur={(e) => e.target.value !== (service.currency ?? '') &&
              onSave(index, 'currency', e.target.value || null)} />
        </td>
        <td style={{ textAlign: 'center' }}>
          <input type="checkbox" data-bwignore
            checked={service.price_is_from === true}
            onChange={(e) => onSave(index, 'price_is_from', e.target.checked)}
            title="Their menu says &ldquo;from&rdquo;"
            style={{ cursor: 'pointer' }} />
        </td>
      </tr>

      {adding && (
        <tr>
          <td colSpan={5} style={{ background: 'var(--warm-cream)' }}>
            <div style={{ padding: 'var(--s3)' }}>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
                            color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>
                Add a practice for &ldquo;{service.name}&rdquo;
              </div>

              {!!suggestions.length && (
                <div style={{ marginBottom: 'var(--s3)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginBottom: 5 }}>
                    Closest in the taxonomy
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {suggestions.filter((h) => h.practiceId).map((h) => (
                      <button key={h.practiceId} type="button" className="pill"
                        style={{ cursor: 'pointer', background: 'var(--warm-white)' }}
                        title={h.why}
                        onClick={() => {
                          onSave(index, 'practice', h.name);
                          setAdding(false);
                        }}>
                        {h.category} · {h.name}
                      </button>
                    ))}
                  </div>
                  {suggestions.some((h) => !h.practiceId) && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 6 }}>
                      Nothing fits exactly, but{' '}
                      {suggestions.filter((h) => !h.practiceId)
                        .map((h) => h.category).join(' or ')} is where it would sit.
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                            flexWrap: 'wrap' }}>
                <div className="f" style={{ minWidth: 220, flex: 1 }}>
                  <label>Call it</label>
                  <input data-bwignore value={newName} style={cell}
                    onChange={(e) => setNewName(e.target.value)} />
                  <span className="help">
                    The plain name, not theirs — &ldquo;Balinese Massage&rdquo;, not
                    &ldquo;Island Serenity Ritual&rdquo;
                  </span>
                </div>
                <div className="f" style={{ minWidth: 200 }}>
                  <label>Category</label>
                  <select value={newCategory} style={cell}
                    onChange={(e) => setNewCategory(
                      e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Choose a category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button className="btn" disabled={busy || !newName.trim() || !newCategory}
                  onClick={() => start(async () => {
                    report('saving');
                    const res = await createPractice(newName, Number(newCategory));
                    report(res.ok ? 'saved' : 'error');
                    if (res.ok && (res as any).practiceName) {
                      onSave(index, 'practice', (res as any).practiceName);
                      setAdding(false);
                    }
                  })}>
                  {busy ? 'Adding…' : 'Add and use it'}
                </button>
                <button className="link-btn" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Shown when a venue looks like one already recorded.
 *
 *  Not a refusal. Genuinely separate venues do share names — every
 *  country has somewhere called Serenity — so the answer is to show what
 *  was found and let a person decide, rather than blocking or silently
 *  creating a second record.
 */
function DuplicateWarning({
  duplicates, pending, onProceed,
}: { duplicates: any[]; pending: boolean; onProceed: () => void }) {
  if (!duplicates.length) return null;

  const certain = duplicates.some((d) => (d.signals ?? []).includes('Same website'));

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${certain ? 'var(--bad)' : 'var(--warn)'}`,
      padding: 'var(--s5)',
      marginTop: 'var(--s4)',
    }}>
      <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase',
                    color: certain ? 'var(--bad)' : 'var(--warn)' }}>
        {certain ? 'Already in the database' : 'This may already be here'}
      </div>

      <div style={{ fontSize: 13, marginTop: 'var(--s3)', lineHeight: 1.6, maxWidth: '68ch' }}>
        {certain
          ? 'A venue with this exact website already exists. Creating another would mean two sets of enquiries and a host booking whichever one nobody updated.'
          : 'Names are similar enough to be worth checking. Genuinely separate venues do share names — every country has somewhere called Serenity — so this is a question rather than a refusal.'}
      </div>

      <table style={{ marginTop: 'var(--s4)' }}>
        <thead>
          <tr><th>Venue</th><th>Why it matched</th><th>Where</th><th></th></tr>
        </thead>
        <tbody>
          {duplicates.map((d) => (
            <tr key={d.venue_id}>
              <td>
                <span className="v-name" style={{ fontSize: 15 }}>{d.venue_name}</span>
                <div className="v-slug">
                  {d.venue_status}
                  {d.website_url && ` · ${d.website_url.replace(/^https?:\/\/(www\.)?/, '')}`}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(d.signals ?? []).map((s: string) => (
                    <span key={s} className={`pill ${s === 'Same website' ? 'gold' : 'empty'}`}
                          style={{ fontSize: 9 }}>{s}</span>
                  ))}
                </div>
              </td>
              <td className="v-slug">
                {[d.city, d.country].filter(Boolean).join(', ') || '—'}
              </td>
              <td style={{ textAlign: 'right' }}>
                <Link className="btn quiet" href={`/venues/${d.venue_id}/reread`}>
                  Read their site again
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 'var(--s4)', display: 'flex', gap: 'var(--s3)',
                    alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn quiet" disabled={pending} onClick={onProceed}>
          Create it anyway
        </button>
        <span className="help" style={{ margin: 0 }}>
          {certain
            ? 'Only if this is genuinely a different venue on a shared website'
            : 'If these are different places, this is the right choice'}
        </span>
      </div>
    </div>
  );
}

/** Locations of one brand.
 *
 *  Each becomes its own venue, because each has its own address, opening
 *  hours and often its own services — a guest searching Sydney must not
 *  be shown Melbourne. The brand exists above them because the commercial
 *  relationship does: one contract, one commission rate, and a brand that
 *  leaves takes every location with it.
 */
function BrandLocations({
  locations, chosen, onToggle, brandName, onBrandName, pending, onRead,
}: {
  locations: any[];
  chosen: Set<string>;
  onToggle: (url: string) => void;
  brandName: string;
  onBrandName: (v: string) => void;
  pending: boolean;
  onRead: () => void;
}) {
  const known = locations.filter((l) => l.existing);
  const fresh = locations.filter((l) => !l.existing);

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--gold)',
      padding: 'var(--s5)',
      marginTop: 'var(--s4)',
    }}>
      <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase',
                    color: 'var(--ink-gold)' }}>
        {locations.length} location{locations.length === 1 ? '' : 's'} found
      </div>

      <div style={{ fontSize: 13, marginTop: 'var(--s3)', lineHeight: 1.6,
                    maxWidth: '68ch' }}>
        <strong>Each becomes its own venue.</strong> They have their own addresses, opening hours
        and often their own services — and a guest searching Sydney should not be shown Melbourne.
        <br /><br />
        A brand is recorded above them, because the commercial relationship sits there: one
        contract, one commission rate, and a brand that leaves takes every location with it.
      </div>

      <div className="f" style={{ maxWidth: 320, marginTop: 'var(--s4)' }}>
        <label>Brand name</label>
        <input data-bwignore value={brandName} placeholder="AIRE Ancient Baths"
          style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                   padding: '7px 9px', width: '100%', fontSize: 13 }}
          onChange={(e) => onBrandName(e.target.value)} />
        <span className="help">Taken from the domain if left blank</span>
      </div>

      <div style={{ marginTop: 'var(--s4)' }}>
        <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
                      color: 'var(--ink-quiet)', marginBottom: 6 }}>
          To read
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {fresh.map((l) => {
            const on = chosen.has(l.url);
            return (
              <button key={l.url} type="button" className={`pill ${on ? 'gold' : ''}`}
                disabled={pending}
                title={l.url}
                style={{ cursor: 'pointer', background: on ? undefined : 'var(--warm-white)' }}
                onClick={() => onToggle(l.url)}>
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      {!!known.length && (
        <div style={{ marginTop: 'var(--s4)' }}>
          <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
                        color: 'var(--ink-quiet)', marginBottom: 6 }}>
            Already recorded
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {known.map((l) => (
              <Link key={l.url} className="pill" style={{ borderStyle: 'dashed' }}
                href={`/venues/${l.existing.id}/details`}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                    marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
        <button className="btn" disabled={pending || !chosen.size} onClick={onRead}>
          {pending
            ? 'Reading each location…'
            : `Read ${chosen.size} and create ${chosen.size === 1 ? 'it' : 'them'}`}
        </button>
        <span className="help" style={{ margin: 0 }}>
          Each is read separately — about three cents each, so {chosen.size} is
          roughly ${(chosen.size * 0.035).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
