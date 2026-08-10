'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { pageToText } from '@/lib/aiExtract';
import { extractLinks } from '@/lib/socialLinks';
import {
  buildIntakePrompt, discoverLocations, discoverPages, findBrandName, findLogo,
  INTAKE_MODEL,
} from '@/lib/venueIntake';
import { createClient } from '@/lib/supabase/server';
import { backfillLocalArea } from '@/app/actions/localArea';

export type Result =
  | { ok: false; error: string; draftId?: number; duplicates?: unknown[] }

  | { ok: true; draftId?: number; venueId?: number; message?: string;
      /** What was found, returned so a screen holding the payload in
       *  local state can update without a round trip — a refresh
       *  re-fetches the server data but React keeps component state, so
       *  the fields would otherwise stay as they were. */
      fields?: Record<string, unknown>; duplicates?: unknown[];
      /** Locations found on the page, where three or more suggest a group
       *  rather than a place. Pasting aman.com and getting one venue
       *  called Aman is a mistake nobody notices until thirty-four
       *  records are missing. */
      possibleLocations?: { url: string; label: string }[] };

/* ── reading what a model returned ──────────────────────────────────
   Shared, because two functions now parse model output and a second copy
   would drift from the first. */

const num = (v: any) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const bool = (v: any) => (v === true ? true : v === false ? false : null);

/** Text arrays, discarding anything empty or absurdly long — a model
 *  asked for short phrases occasionally returns a paragraph. */
const arr = (v: any): string[] | null => {
  if (!Array.isArray(v) || !v.length) return null;
  const clean = v.map((x) => String(x ?? '').trim())
    .filter((x) => x && x.length <= 200);
  return clean.length ? clean : null;
};



const UA = 'Mozilla/5.0 (compatible; TheGlobalSanctumBot/1.0; +https://www.theglobalsanctum.com)';

function cost(input: number, output: number) {
  return (input / 1_000_000) * 1.0 + (output / 1_000_000) * 5.0;
}

/** Hashed on the extracted text rather than the markup.
 *
 *  A site that regenerates a session id, a nonce or a timestamp on every
 *  request would otherwise look changed every single time, which defeats
 *  the point — the whole reason to hash is to avoid paying for an answer
 *  already given. */
const hashText = (text: string) =>
  createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 32);

/** Fetches a document as bytes, to be sent to the API as it stands.
 *
 *  Not extracted first. An earlier attempt parsed the PDF by hand and
 *  failed: modern PDFs store text as subsetted font glyph indices —
 *  <0001> Tj rather than (Hello) Tj — which cannot be read without the
 *  font's own character map. Writing a full extractor is a project.
 *
 *  The API reads PDFs directly, including scanned ones, with tables and
 *  layout intact. Roughly a cent for a four-page rate card, which is
 *  nothing against what those four pages contain. */
async function fetchDocument(
  url: string
): Promise<{ base64: string; pages: number } | { error: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow', signal: AbortSignal.timeout(25_000), cache: 'no-store',
    });
    if (!res.ok) return { error: `${res.status}` };

    const type = res.headers.get('content-type') ?? '';
    if (!/pdf/i.test(type) && !/\.pdf$/i.test(url)) return { error: 'not a PDF' };

    const buf = await res.arrayBuffer();
    // The API caps documents at 32 MB, and a file that large is a
    // photographic brochure rather than a rate card.
    if (buf.byteLength > 10_000_000) return { error: 'too large' };
    if (buf.byteLength < 1000) return { error: 'empty' };

    const raw = Buffer.from(buf);
    const pages = (raw.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length || 1;
    // Long documents are skipped rather than truncated: a 60 page
    // brochure costs real money and says less than the rates page.
    if (pages > 25) return { error: `${pages} pages — too long to be a rate card` };

    return { base64: raw.toString('base64'), pages };
  } catch (e: any) {
    return { error: e?.name === 'TimeoutError' ? 'timed out' : 'unreachable' };
  }
}

async function fetchPage(url: string): Promise<{ html: string } | { error: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: AbortSignal.timeout(15_000), cache: 'no-store',
    });
    if (!res.ok) return { error: `${res.status}` };
    return { html: await res.text() };
  } catch (e: any) {
    return { error: e?.name === 'TimeoutError' ? 'timed out' : 'unreachable' };
  }
}

/** Reads a venue's site and returns a draft.
 *
 *  Several pages, because a home page rarely states capacity and an
 *  Accommodation page always does. Nothing is written to venues — the
 *  whole extraction is held as a draft until somebody has looked at it. */
export async function readVenueFromUrl(
  rawUrl: string,
  pastedText?: string,
  /** Set when refreshing a venue that already exists rather than creating
   *  one. The previous read is kept — what changed between them is worth
   *  seeing, and a venue that has quietly dropped a shala is exactly the
   *  thing nobody notices. */
  refreshesVenueId?: number | null,
): Promise<Result> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY is not set in Vercel.' };

  const url = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  let origin: string;
  try { origin = new URL(url).href; } catch { return { ok: false, error: 'That is not a usable address.' }; }

  const supabase = await createClient();

  const read: string[] = [];
  const failed: string[] = [];
  const hashes: Record<string, string> = {};

  // The last successful read of this venue, whether it created the record
  // or refreshed it — its hashes are what makes a free re-read possible.
  const { data: previous } = refreshesVenueId
    ? await supabase.from('venue_intake_drafts')
        .select('id,page_hashes,payload')
        .or(`refreshes_venue_id.eq.${refreshesVenueId},venue_id.eq.${refreshesVenueId}`)
        .not('payload', 'is', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const { data: draft } = await supabase.from('venue_intake_drafts').insert({
    source_url: origin,
    pasted_text: pastedText || null,
    status: 'Reading',
    refreshes_venue_id: refreshesVenueId ?? null,
    previous_draft_id: previous?.id ?? null,
    run_kind: refreshesVenueId ? 'Re-read' : 'New venue',
  }).select('id').single();
  if (!draft) return { ok: false, error: 'Could not start the draft.' };

  let usage = { input_tokens: 0, output_tokens: 0 };

  /** Records the tokens as well as the reason. A failure that reports
   *  nothing about itself is diagnosed by guessing — this one looked like
   *  a network fault and was a truncated response. */
  const fail = async (message: string) => {
    await supabase.from('venue_intake_drafts').update({
      status: 'Failed',
      error_message: message,
      input_tokens: usage.input_tokens || null,
      output_tokens: usage.output_tokens || null,
      cost_usd: usage.input_tokens ? cost(usage.input_tokens, usage.output_tokens) : null,
      pages_read: read,
      pages_failed: failed,
    }).eq('id', draft.id);
    return { ok: false as const, error: message };
  };

  // ── the home page, then whatever it links to ──────────────────────
  let links: ReturnType<typeof extractLinks> | null = null;
  const home = await fetchPage(origin);

  // Read from the markup while the home page is in hand, rather than
  // asked for. A model given a page produces a plausible logo URL that
  // 404s, and a broken image on every venue screen is worse than none —
  // nobody can tell whether it failed to load or was never there.
  const logo = 'html' in home
    ? findLogo(home.html, origin)
    : { url: null, source: null };

  // Whether this is one place or a group. Checked on every read rather
  // than only when somebody thinks to ask — pasting aman.com and getting
  // one venue called Aman is a mistake nobody notices until there are
  // thirty-four missing records.
  const looksLikeAGroup = 'html' in home && !refreshesVenueId
    ? discoverLocations(home.html, origin, 40)
    : [];
  const sections: string[] = [];
  const documents: { url: string; label: string; base64: string }[] = [];

  if ('error' in home) {
    // Facebook and Instagram render in JavaScript and return a login wall
    // to anything automated, so a pasted URL alone gives nothing. Pasted
    // text is the way through, and saying so beats a bare failure.
    if (!pastedText?.trim()) {
      return await fail(
        `Could not read that page (${home.error}). Social profiles block automated reading — `
        + 'copy the About section and paste it in, and it will be used instead.');
    }
    failed.push(origin);
  } else {
    links = extractLinks(home.html, origin);

    const text = pageToText(home.html, 14000);
    if (text.length > 200) {
      sections.push(`## Home page\n\n${text}`);
      read.push(origin);
      hashes[origin] = hashText(text);
    }

    // Where the URL points at a section rather than a root — one
    // location of a chain — discovery stays beneath it. Otherwise
    // reading 1hotels.com/melbourne follows links to /tokyo, and
    // Melbourne's record describes Tokyo's spa. Wrong in a way nobody
    // notices, because every page read was genuinely from the right site.
    const pathOfUrl = (() => {
      try {
        const p = new URL(origin).pathname.replace(/\/$/, '');
        // A root, or a single page like /contact, is a whole site.
        // Anything deeper is a section worth staying inside.
        return p.split('/').filter(Boolean).length >= 1 ? p : undefined;
      } catch { return undefined; }
    })();

    const pages = discoverPages(home.html, origin, 10, pathOfUrl);
    for (const p of pages) {
      if (p.isDocument) {
        // Only two, and only where they look like rates or a guide.
        // Documents cost more than pages and the third one is rarely
        // worth it.
        if (documents.length >= 2) continue;
        const doc = await fetchDocument(p.url);
        if ('error' in doc) { failed.push(`${p.url} — ${doc.error}`); continue; }
        documents.push({ url: p.url, label: p.label, base64: doc.base64 });
        read.push(`${p.url} (${doc.pages}pp)`);
        continue;
      }

      const res = await fetchPage(p.url);
      if ('error' in res) { failed.push(`${p.url} — ${res.error}`); continue; }
      const t = pageToText(res.html, 9000);
      if (t.length < 200) { failed.push(`${p.url} — too little text`); continue; }
      sections.push(`## ${p.label} — ${p.holds}\n${p.url}\n\n${t}`);
      read.push(p.url);
      hashes[p.url] = hashText(t);
    }
  }

  if (pastedText?.trim()) {
    sections.push(`## Pasted by hand\n\n${pastedText.trim()}`);
  }

  if (!sections.length && !documents.length) {
    return await fail('Nothing readable was found at that address.');
  }

  /* ── has anything actually changed? ─────────────────────────────
   *
   * Fetching is free; only the model call costs. So where every page
   * matches the last read, there is nothing to pay for — the answer is
   * already stored and re-deriving it would produce the same thing.
   */
  let unchanged = 0;
  let changed = 0;

  if (previous?.page_hashes) {
    const before = previous.page_hashes as Record<string, string>;
    for (const [url, hash] of Object.entries(hashes)) {
      before[url] === hash ? unchanged++ : changed++;
    }
    // A page that has disappeared is a change.
    const gone = Object.keys(before).filter((u) => !(u in hashes));
    changed += gone.length;

    if (changed === 0 && unchanged > 0 && !pastedText) {
      await supabase.from('venue_intake_drafts').update({
        status: 'Ready',
        // The previous answer, unchanged, because the pages producing it
        // are unchanged.
        payload: previous.payload,
        page_hashes: hashes,
        pages_read: read,
        pages_failed: failed,
        unchanged_pages: unchanged,
        changed_pages: 0,
        skipped_no_change: true,
        // The logo is read from markup, not from the model — so it is
        // found even when nothing has changed and the model is skipped.
        // Omitting it here meant a second re-read wiped what the first
        // one found.
        logo_url: logo.url,
        logo_source: logo.source,
        cost_usd: 0,
      }).eq('id', draft.id);

      if (refreshesVenueId) {
        const patch: Record<string, unknown> = {
          last_intake_at: new Date().toISOString(),
          last_intake_draft_id: draft.id,
        };

        // Even where nothing changed, the logo may be new to us — the
        // pages are identical to last time but we only started looking
        // for a logo recently.
        const { data: existing } = await supabase.from('venues')
          .select('logo_url,logo_source,website_url').eq('id', refreshesVenueId).single();

        if (logo.url
            && (!existing?.logo_url || existing.logo_source === 'Read from their site')) {
          patch.logo_url = logo.url;
          patch.logo_source = 'Read from their site';
        }

        // The page was just read, so its address is known. Filling it
        // stops the field sitting empty on a venue whose site was
        // plainly reachable.
        if (!existing?.website_url) patch.website_url = origin;

        await supabase.from('venues').update(patch).eq('id', refreshesVenueId);
      }

      revalidatePath('/venues/new');
      revalidatePath(`/venues/${refreshesVenueId}/details`);
      return {
        ok: true,
        draftId: draft.id,
        message: `Nothing has changed — all ${unchanged} pages match the last read. `
          + 'Nothing was spent.'
          + (logo.url ? ' Their logo was picked up.' : ''),
      };
    }
  }

  // ── read it ───────────────────────────────────────────────────────
  const [{ data: types }, { data: hires }] = await Promise.all([
    supabase.from('venue_types').select('name').order('name'),
    supabase.from('hire_types').select('name').order('name'),
  ]);

  let parsed: any;
  // Outside the try, since the draft written afterwards records whether a
  // second pass was needed.
  let attempt = 1;

  /** One attempt, over the sections given.
   *
   *  Separated so a truncated answer can be retried with fewer pages
   *  rather than failed. A venue that describes itself at length is
   *  exactly the venue worth reading, and "read fewer pages" is not
   *  something the button lets anybody do. */
  const askModel = async (useSections: string[]) =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: INTAKE_MODEL,
        max_tokens: 24000,
        system: buildIntakePrompt(
          (types ?? []).map((t: any) => t.name),
          (hires ?? []).map((h: any) => h.name)),
        messages: [{
          role: 'user',
          content: [
            // Documents first: a rate card is more authoritative than a
            // page describing rates, and putting it first means the model
            // reads it as the source rather than as a footnote.
            ...documents.map((d) => ([
              { type: 'text', text: `The following is their ${d.label}, from ${d.url}` },
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: d.base64 },
              },
            ])).flat(),
            { type: 'text', text: useSections.join('\n\n---\n\n') },
          ],
        }],
      }),
      signal: AbortSignal.timeout(120_000),
    });

  try {
    let res = await askModel(sections);

    if (!res.ok) {
      const body = await res.text();
      return await fail(
        res.status === 401 ? 'The API key was rejected.'
        : res.status === 429 ? 'Rate limited — try again shortly.'
        : /credit/i.test(body) ? 'Out of API credit.'
        : `Anthropic returned ${res.status}.`);
    }

    let json = await res.json();
    usage = json.usage ?? usage;

    // Truncation is invisible without checking: the response arrives,
    // looks fine, and stops mid-object.
    //
    // Retried once with the longest pages dropped. Halving the input is
    // cheaper than a second full read and usually enough, since the pages
    // that blow the limit are the ones repeating a menu three times.
    if (json.stop_reason === 'max_tokens' && sections.length > 4) {
      const shorter = [...sections]
        .sort((a, b) => a.length - b.length)
        .slice(0, Math.max(4, Math.floor(sections.length / 2)));

      res = await askModel(shorter);
      attempt = 2;

      if (res.ok) {
        json = await res.json();
        usage = {
          input_tokens: usage.input_tokens + (json.usage?.input_tokens ?? 0),
          output_tokens: usage.output_tokens + (json.usage?.output_tokens ?? 0),
        };
      }
    }

    if (json.stop_reason === 'max_tokens') {
      return await fail(
        'The site describes itself at more length than one reply can hold, even '
        + 'after dropping the longest pages. Read the sections separately with '
        + '"Read one page" instead — a spa menu on its own fits comfortably.');
    }

    const text = (json.content ?? [])
      .filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const cleaned = text.replace(/```json|```/g, '').trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first === -1 || last <= first) {
      return await fail(
        `Nothing usable came back — ${cleaned.length} characters, no JSON object.`);
    }
    try {
      parsed = JSON.parse(cleaned.slice(first, last + 1));
    } catch (e: any) {
      return await fail(
        `The answer was not valid JSON: ${String(e?.message ?? '').slice(0, 120)}`);
    }
  } catch (e: any) {
    return await fail(
      e?.name === 'TimeoutError'
        ? 'The site took too long to read. Try again, or read fewer pages.'
        : `Could not reach Anthropic: ${String(e?.message ?? '').slice(0, 100)}`);
  }

  // Read from the markup rather than taken from the model's answer, which
  // is why they are merged in afterwards. The model may also have found
  // them; the page is the better source either way.
  if (links) {
    for (const [col, url] of Object.entries(links.fields)) parsed[col] = url;
    if (links.whatsapp) parsed.whatsapp_number = links.whatsapp;
    if (links.other.length) parsed.other_links = links.other;
  }

  if (refreshesVenueId) {
    const patch: Record<string, unknown> = {
      last_intake_at: new Date().toISOString(),
      last_intake_draft_id: draft.id,
    };

    // Applied straight away where the venue has none. A logo is not a
    // judgement anybody made, so there is nothing to overwrite — but one
    // set by hand is a decision and stays.
    if (logo.url) {
      const { data: existing } = await supabase.from('venues')
        .select('logo_url,logo_source,website_url').eq('id', refreshesVenueId).single();

      if (!existing?.logo_url || existing.logo_source === 'Read from their site') {
        patch.logo_url = logo.url;
        patch.logo_source = 'Read from their site';
      }
      if (!existing?.website_url) patch.website_url = origin;
    }

    await supabase.from('venues').update(patch).eq('id', refreshesVenueId);
  }

  await supabase.from('venue_intake_drafts').update({
    status: 'Ready',
    payload: parsed,
    page_hashes: hashes,
    unchanged_pages: unchanged || null,
    changed_pages: changed || null,
    pages_read: read,
    pages_failed: failed,
    // Recorded, because a read that needed a second pass is a venue whose
    // site will do it again — and the log should say so rather than
    // looking like every other read.
    read_note: attempt > 1
      ? 'The first answer was cut off, so the longest pages were dropped and it was read again.'
      : null,
    logo_url: logo.url,
    logo_source: logo.source,
    // Recorded even where it turns out to be one venue, so the finding is
    // visible rather than being a warning that flashed past.
    possible_locations: looksLikeAGroup.length >= 3
      ? looksLikeAGroup.map((l) => ({ url: l.url, label: l.label }))
      : null,
    flags: parsed.flags ?? [],
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: cost(usage.input_tokens, usage.output_tokens),
  }).eq('id', draft.id);

  revalidatePath('/venues/new');
  return {
    ok: true,
    draftId: draft.id,
    possibleLocations: looksLikeAGroup.length >= 3
      ? looksLikeAGroup.map((l) => ({ url: l.url, label: l.label }))
      : undefined,
    message: `${read.length} page${read.length === 1 ? '' : 's'} read · `
      + `$${cost(usage.input_tokens, usage.output_tokens).toFixed(4)}`,
  };
}

export async function getDraft(id: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_intake_drafts')
    .select('*').eq('id', id).single();
  return data;
}

export async function updateDraftField(
  id: number, path: string, value: unknown
): Promise<Result> {
  const supabase = await createClient();
  const { data: draft } = await supabase.from('venue_intake_drafts')
    .select('payload').eq('id', id).single();
  if (!draft) return { ok: false, error: 'Draft not found.' };

  const payload = { ...(draft.payload as any), [path]: value };
  const { error } = await supabase.from('venue_intake_drafts')
    .update({ payload }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Turns a checked draft into a venue.
 *
 *  Geography is resolved against the existing tables rather than written
 *  as text — a venue with "Queensland" in a field is not a venue you can
 *  find on a map or publish a URL for. */
export async function acceptDraft(id: number): Promise<Result> {
  const supabase = await createClient();

  const { data: draft } = await supabase.from('venue_intake_drafts')
    .select('*').eq('id', id).single();
  if (!draft?.payload) return { ok: false, error: 'Nothing to accept.' };

  const p = draft.payload as any;

  // Name normalised to NFC so an accent is one codepoint rather than two.
  // They look identical and do not compare equal, which breaks search and
  // deduplication silently.
  const { data: name } = await supabase.rpc('normalise_name', { p: p.venue_name });
  if (!name) return { ok: false, error: 'The draft has no venue name.' };

  const [{ data: country }, { data: type }] = await Promise.all([
    p.country
      ? supabase.from('countries').select('id').ilike('name', p.country).maybeSingle()
      : Promise.resolve({ data: null }),
    p.venue_type
      ? supabase.from('venue_types').select('id').ilike('name', p.venue_type).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // maybeSingle raises where two rows match, and two cities sharing a
  // name inside one country is ordinary. limit(1) takes one instead of
  // failing the whole read over it.
  const { data: stateRows } = country?.id && p.state
    ? await supabase.from('states').select('id')
        .eq('country_id', country.id).ilike('name', p.state).limit(1)
    : { data: null };
  let state = stateRows?.[0] ?? null;

  // A city was only looked for where a state had matched, so a venue
  // saying "Canggu, Indonesia" — no province — got no city, no timezone
  // and no coordinates. Which is most of them, since a website rarely
  // names a province.
  let city: { id: number; state_id: number | null } | null = null;

  if (p.city) {
    if (state?.id) {
      const { data } = await supabase.from('cities')
        .select('id,state_id').eq('state_id', state.id)
        .ilike('name', p.city).limit(1);
      city = data?.[0] ?? null;
    }

    // Then by country, which is the common case.
    if (!city && country?.id) {
      const { data } = await supabase.from('cities')
        .select('id,state_id').eq('country_id', country.id)
        .ilike('name', p.city).limit(1);
      city = data?.[0] ?? null;
    }

    // The city knows its own state, so finding one fills the level above
    // it rather than leaving a gap between country and city.
    if (city?.state_id && !state?.id) {
      state = { id: city.state_id } as any;
    }
  }

  const { data: venue, error } = await supabase.from('venues').insert({
    venue_name: name,
    venue_type_id: type?.id ?? null,
    venue_short_description: p.venue_short_description ?? null,
    setting_headline: p.setting_headline ?? null,
    setting_description: p.setting_description ?? null,
    location_tagline: p.location_tagline ?? null,
    parking_notes: p.parking_notes ?? null,
    floor_area: num(p.floor_area),
    timezone: p.timezone ?? null,
    street_address: p.street_address ?? null,
    postcode: p.postcode ?? null,
    country_id: country?.id ?? null,
    state_id: state?.id ?? null,
    city_id: city?.id ?? null,
    // What they call it, kept whether or not it matched. A venue in
    // Canggu is filed under Legian and says Canggu — the second is what a
    // guest searches for.
    // What they call it, kept whether or not it matched a list. A venue
    // in Canggu is filed under Legian and says Canggu — the second is
    // what a guest searches for.
    locality: p.locality ?? p.city ?? null,
    locality_source: (p.locality ?? p.city) ? 'Read from their site' : null,
    contact_phone: p.contact_phone ?? null,
    contact_email: p.contact_email ?? null,
    website_url: p.website_url ?? draft.source_url,
    instagram_url: p.instagram_url ?? null,
    facebook_url: p.facebook_url ?? null,
    linkedin_url: p.linkedin_url ?? null,
    youtube_url: p.youtube_url ?? null,
    tiktok_url: p.tiktok_url ?? null,
    pinterest_url: p.pinterest_url ?? null,
    tripadvisor_url: p.tripadvisor_url ?? null,
    google_business_url: p.google_business_url ?? null,
    booking_engine_url: p.booking_engine_url ?? null,
    whatsapp_number: p.whatsapp_number ?? null,
    other_links: p.other_links ?? null,
    max_guests: num(p.max_guests),
    total_bedrooms: num(p.total_bedrooms),
    total_bathrooms: num(p.total_bathrooms),
    established_year: num(p.established_year),
    property_size: num(p.property_size),
    property_size_unit: p.property_size_unit ?? null,
    byo_facilitator_friendly: bool(p.byo_facilitator_friendly),
    external_practitioners_welcome: bool(p.external_practitioners_welcome),
    wifi_available: bool(p.wifi_available),
    pets_allowed: bool(p.pets_allowed),
    children_allowed: bool(p.children_allowed),
    price_from: num(p.price_from),
    price_currency: p.price_currency ?? null,

    // The longer copy, in their voice.
    venue_full_description: p.venue_full_description ?? null,
    introduction_text: p.introduction_text ?? null,
    location_intro: p.location_intro ?? null,
    accommodation_description: p.accommodation_description ?? null,
    accommodation_style: p.accommodation_style ?? null,
    venue_highlights: arr(p.venue_highlights),

    // Numbers a site usually states somewhere.
    min_guests: num(p.min_guests),
    day_guest_capacity: num(p.day_guest_capacity),
    private_ensuites: num(p.private_ensuites),
    shared_bathrooms: num(p.shared_bathrooms),
    treatment_rooms: num(p.treatment_rooms),
    beds_king: num(p.beds_king),
    beds_queen: num(p.beds_queen),
    beds_double: num(p.beds_double),
    beds_single: num(p.beds_single),
    beds_twin: num(p.beds_twin),
    beds_bunk: num(p.beds_bunk),
    beds_sofa: num(p.beds_sofa),

    // Arriving and staying.
    check_in_time: p.check_in_time ?? null,
    check_out_time: p.check_out_time ?? null,
    minimum_stay_nights: num(p.minimum_stay_nights),
    minimum_child_age: num(p.minimum_child_age),
    smoking_allowed: bool(p.smoking_allowed),
    languages: arr(p.languages),

    // What a retreat host asks before booking.
    wifi_details: p.wifi_details ?? null,
    wifi_coverage: p.wifi_coverage ?? null,
    wifi_speed_mbps: num(p.wifi_speed_mbps),
    mobile_coverage: p.mobile_coverage ?? null,
    parking_type: p.parking_type ?? null,
    parking_spaces: num(p.parking_spaces),
    nearest_transport: p.nearest_transport ?? null,
    // An array, not prose — several ways in rather than one sentence.
    transport_access: arr(p.transport_access),
    nearby_attractions: arr(p.nearby_attractions),
    please_bring: arr(p.please_bring),
    we_provide: arr(p.we_provide),

    // Who it suits.
    best_for: arr(p.best_for),
    ideal_retreat_types: arr(p.ideal_retreat_types),
    typical_group_profile: p.typical_group_profile ?? null,
    byo_chef_permitted: bool(p.byo_chef_permitted),
    can_arrange_services: bool(p.can_arrange_services),

    // The property.
    property_type: p.property_type ?? null,
    architecture_style: p.architecture_style ?? null,
    business_status: p.business_status ?? null,
    // The type comes from coordinates rather than the page — a site
    // saying "sunny" is not a climate classification, and latitude is.
    climate_intro: p.climate_intro ?? null,
    climate_note: p.climate_note ?? null,
    best_months: p.best_months ?? null,
    pool_type: p.pool_type ?? null,
    sustainability_practices: arr(p.sustainability_practices),

    // Access. Never inferred — an inference here could put somebody in a
    // place they cannot get into.
    accessibility_summary: p.accessibility_summary ?? null,
    // Never inferred. "Accessible" on a website does not mean step free,
    // and a photograph of a ramp is not a statement.
    step_free_entrance: bool(p.step_free_entrance),
    step_free_to_dining: bool(p.step_free_to_dining),
    step_free_to_practice_space: bool(p.step_free_to_practice_space),
    accessible_parking: bool(p.accessible_parking),
    access_path_notes: p.access_path_notes ?? null,
    accessible_rooms: num(p.accessible_rooms),
    accessible_bathrooms: num(p.accessible_bathrooms),
    elevator_access: bool(p.elevator_access),
    // A count, not a yes/no. "Are there ground floor rooms" and "how many"
    // are different questions, and the column asks the second.
    ground_floor_rooms: num(p.ground_floor_rooms),
    first_aid_on_site: bool(p.first_aid_on_site),
    defibrillator_on_site: bool(p.defibrillator_on_site),

    primary_image_url: p.primary_image_url ?? null,

    venue_status: 'Sourced',
    // Set by the thing that created it, never typed. Distinct from
    // venue_source_type, which says where the venue was found — a venue
    // spotted on Instagram and then harvested has both.
    created_via: 'Website read',
    created_via_detail: draft.source_url,
    logo_url: draft.logo_url ?? null,
    logo_source: draft.logo_url ? 'Read from their site' : null,
  }).select('id').single();

  if (error) return { ok: false, error: error.message };

  // ── child records ────────────────────────────────────────────────
  const child = async (table: string, rows: any[]) => {
    if (!rows?.length) return;
    const { error } = await supabase.from(table).insert(
      rows.map((r, i) => ({ ...r, venue_id: venue.id, display_order: i + 1 })));
    // A wrong column name failed every insert and said nothing, so it
    // looked like the site had no rooms rather than like a bug.
    if (error) console.error(`${table} insert failed:`, error.message);
  };

  // Placed on the map as part of being read, rather than waiting for
  // somebody to run a separate pass. Applied only where both sources
  // agree; anything doubtful is left as a check for a person.
  try {
    const { geocodeAfterIntake } = await import('./geocode');
    await geocodeAfterIntake(venue.id);

    // The suburb, once there is a coordinate to find it from. Created
    // where no list has it — Canggu is a real place and a list that has
    // never heard of it is the thing that is wrong.
    await supabase.rpc('place_by_coordinates', {
      p_venue_id: venue.id,
      p_locality_name: p.locality ?? p.city ?? null,
    });
  } catch {
    // A geocoding failure must not lose the read. The venue is created
    // either way and can be placed later.
  }

  // Packages, with their parts as rows rather than a line of prose. A
  // venue selling hot stone massage only inside a ritual should still be
  // findable by somebody searching for hot stone massage.
  for (const pk of (p.packages ?? []) as any[]) {
    if (!pk?.name) continue;

    const { data: pkg } = await supabase.from('venue_packages').insert({
      venue_id: venue.id,
      name: pk.name,
      tagline: pk.tagline ?? null,
      description: pk.description ?? null,
      duration_label: pk.duration_label ?? null,
      total_duration_minutes: num(pk.total_duration_minutes),
      price: num(pk.price),
      currency: pk.currency ?? null,
      available_months: Array.isArray(pk.available_months) ? pk.available_months : null,
      inclusions: Array.isArray(pk.items)
        ? pk.items.map((i: any) => i?.name).filter(Boolean)
        : null,
    }).select('id').single();

    if (!pkg) continue;

    let order = 0;
    for (const item of (pk.items ?? []) as any[]) {
      if (!item?.name) continue;
      order += 1;

      // Matched to a real service where one exists, so the package is
      // searchable by what is in it.
      const { data: hit } = await supabase.rpc('match_practice', {
        p_phrase: String(item.name),
      });
      const practiceId = hit?.[0]?.confidence === 'Exact'
        || hit?.[0]?.confidence === 'Known wording'
        ? hit[0].practice_id : null;

      const { data: service } = practiceId
        ? await supabase.from('venue_services')
            .select('id').eq('venue_id', venue.id)
            .eq('practice_id', practiceId).limit(1).maybeSingle()
        : { data: null };

      await supabase.from('venue_package_items').insert({
        package_id: pkg.id,
        service_id: service?.id ?? null,
        label: service?.id ? null : item.name,
        duration_minutes: num(item.duration_minutes),
        is_optional: bool(item.is_optional) ?? false,
        display_order: order,
      });
    }
  }

  // Awards, only where the site claims one in words.
  for (const aw of (p.awards ?? []) as any[]) {
    if (!aw?.name) continue;

    const { data: body } = await supabase.from('award_bodies')
      .select('id').ilike('name', aw.name).limit(1).maybeSingle();

    await supabase.from('venue_awards').insert({
      venue_id: venue.id,
      award_body_id: body?.id ?? null,
      award_name: body?.id ? null : aw.name,
      level: aw.level ?? null,
      year_awarded: num(aw.year),
      source_url: draft.source_url,
    });
  }

  // The people a venue publishes as contacts. A concierge introducing a
  // retreat host writes to a person, not to info@ — and until now every
  // named contact on a website was discarded in favour of one email.
  for (const person of (p.people ?? []) as any[]) {
    await supabase.rpc('upsert_venue_contact', {
      p_venue_id: venue.id,
      p_first_name: person.first_name ?? null,
      p_surname: person.surname ?? null,
      p_role: person.role ?? null,
      p_email: person.email ?? null,
      p_phone: person.phone ?? null,
      p_source: 'Read from their site',
      p_source_url: draft.source_url,
      // The first named person becomes primary only where nothing else
      // is — the function enforces that, so this is a request not a
      // claim.
      p_is_primary: true,
    });
  }

  // Seasons — the climate table on the location tab. What a season suits
  // is kept separate from the description, because a host choosing dates
  // is filtering on exactly that.
  await child('venue_seasons', (p.seasons ?? []).map((x: any) => ({
    season_name: x.season_name,
    months: x.months ?? null,
    temp_low: num(x.temp_low),
    temp_high: num(x.temp_high),
    temp_unit: x.temp_unit ?? 'C',
    best_for: x.best_for ?? null,
    is_peak: bool(x.is_peak),
    description: x.description ?? null,
  })));

  const roomRows = (p.room_types ?? []).map((r: any) => ({
    name: r.name,
    quantity: num(r.quantity) ?? 1,
    sleeps: num(r.sleeps),
    // As written. "King or 2 x singles" is what a retreat host needs;
    // "1 bed" is not the same information.
    bed_configuration: r.bed_configuration ?? null,
    bathroom_type: r.bathroom_type ?? (r.ensuite === true ? 'Ensuite' : null),
    description: r.description ?? null,
    room_size: num(r.room_size),
    room_size_unit: r.room_size_unit ?? null,
    outlook: r.outlook ?? null,
    room_amenities: arr(r.room_amenities)
      ?? (r.room_amenities ? [String(r.room_amenities)] : null),
    is_accessible: bool(r.is_accessible),
    step_free_access: bool(r.step_free_access),
    floor_level: r.floor_level ?? null,
    primary_image_url: r.image_url ?? null,
  }));

  if (roomRows.length) {
    const { data: rooms } = await supabase.from('venue_room_types').insert(
      roomRows.map((r: any, i: number) => ({ ...r, venue_id: venue.id, display_order: i + 1 })),
    ).select('id,name');

    // Beds as counts rather than prose. "King or two singles" written out
    // cannot answer "which venues sleep twelve without anyone sharing",
    // which is the question every retreat host asks.
    const [{ data: bedTypes }, { data: items }] = await Promise.all([
      supabase.from('bed_types').select('id,slug'),
      supabase.from('facility_items').select('id,name,slug')
        .in('room_scope', ['Room', 'Either']),
    ]);

    const bedBySlug = new Map((bedTypes ?? []).map((b: any) => [b.slug, b.id]));
    const itemByName = new Map(
      (items ?? []).map((i: any) => [i.name.toLowerCase(), i.id]));

    const beds: any[] = [];
    const facilities: any[] = [];
    const services: any[] = [];
    const unmatchedAmenities: { phrase: string; roomId: number }[] = [];

    (rooms ?? []).forEach((row: any, i: number) => {
      const source = p.room_types[i] ?? {};

      for (const b of source.beds ?? []) {
        const id = bedBySlug.get(String(b.type ?? '').toLowerCase());
        if (!id) continue;
        beds.push({
          room_type_id: row.id,
          bed_type_id: id,
          quantity: Number(b.quantity) || 1,
          configuration_group: Number(b.group) || 1,
        });
      }

      for (const a of source.in_room_amenities ?? []) {
        const phrase = String(a).trim();
        if (!phrase) continue;
        // Matched against the catalogue including its synonyms, so a
        // wording accepted once is recognised everywhere afterwards.
        unmatchedAmenities.push({ phrase, roomId: row.id });
      }

      for (const svc of source.in_room_services ?? []) {
        if (!svc) continue;
        services.push({ room_type_id: row.id, name: String(svc).slice(0, 120) });
      }
    });

    // Matched through the database so synonyms count, and anything still
    // unrecognised is recorded rather than discarded — a phrase twenty
    // venues use is a gap in the catalogue, not noise.
    for (const { phrase, roomId } of unmatchedAmenities) {
      const { data: hit } = await supabase.rpc('match_facility', {
        p_phrase: phrase, p_scope: 'Room',
      });
      if (hit?.[0]?.facility_item_id) {
        facilities.push({ room_type_id: roomId, facility_item_id: hit[0].facility_item_id });
      } else {
        await supabase.rpc('note_facility_candidate', {
          p_phrase: phrase,
          p_scope: 'Room',
          p_venue_id: venue.id,
          p_url: draft.source_url,
        });
      }
    }

    // Duplicates are possible where a site lists the same amenity twice.
    if (beds.length) {
      await supabase.from('room_type_beds')
        .upsert(beds, { onConflict: 'room_type_id,bed_type_id,configuration_group',
                        ignoreDuplicates: true });
    }
    if (facilities.length) {
      await supabase.from('room_type_facilities')
        .upsert(facilities, { onConflict: 'room_type_id,facility_item_id',
                              ignoreDuplicates: true });
    }
    if (services.length) await supabase.from('room_type_services').insert(services);
  }

  // Spaces are inserted first, then their capacities, because a capacity
  // belongs to a space that has to exist to be referenced.
  if (p.spaces?.length) {
    const { data: spaces } = await supabase.from('venue_spaces').insert(
      p.spaces.map((s: any, i: number) => ({
        venue_id: venue.id,
        name: s.name,
        space_type: s.space_type ?? null,
        description: s.description ?? null,
        // The column is is_outdoor, not is_indoor. Inverted rather than
        // renamed, because a space with no answer must stay null — an
        // unknown must not become "indoor" by accident.
        is_outdoor: s.is_indoor === true ? false
                  : s.is_indoor === false ? true
                  : bool(s.is_outdoor),
        is_covered: bool(s.is_covered),
        area: num(s.area),
        area_unit: s.area_unit ?? null,
        // What a listing shows in its stat bar, and what a host asks
        // about before booking a room they cannot see.
        flooring: s.flooring ?? null,
        climate_control: s.climate_control ?? null,
        lighting: s.lighting ?? null,
        acoustics: s.acoustics ?? null,
        view_type: s.view_type ?? null,
        outlook: s.outlook ?? null,
        // Both are arrays. A single phrase is wrapped rather than
        // discarded, since a model asked for a list occasionally returns
        // a sentence.
        equipment_provided: arr(s.equipment_provided)
          ?? (s.equipment_provided ? [String(s.equipment_provided)] : null),
        suitable_for: arr(s.suitable_for)
          ?? (s.suitable_for ? [String(s.suitable_for)] : null),
        step_free_access: bool(s.step_free_access),
        floor_level: s.floor_level ?? null,
        distance_from_accommodation_m: num(s.distance_from_accommodation_m),
        path_surface: s.path_surface ?? null,
        primary_image_url: s.image_url ?? null,
        display_order: i + 1,
      }))).select('id,name,area');

    // "18 for yoga or 40 seated" becomes two rows, each against what it
    // is a capacity FOR. A single number cannot answer "will twenty
    // people fit lying down".
    const { data: usages } = await supabase.from('space_usages').select('id,slug');
    const usageId = new Map((usages ?? []).map((u: any) => [u.slug, u.id]));

    const caps: any[] = [];
    (spaces ?? []).forEach((row: any, i: number) => {
      for (const c of p.spaces[i]?.capacities ?? []) {
        const id = usageId.get(String(c.usage ?? '').toLowerCase());
        const n = num(c.capacity);
        if (!id || !n) continue;
        caps.push({ space_id: row.id, usage_id: id, capacity: n, source: 'Website' });
      }
    });
    if (caps.length) await supabase.from('venue_space_capacities').insert(caps);

    // Where a floor area is given, the remaining usages are worked out
    // and marked as estimates.
    for (const row of spaces ?? []) {
      if (row.area) await supabase.rpc('estimate_space_capacities', { p_space_id: row.id });
    }
  }

  // Wellness services, matched to the taxonomy.
  //
  // The previous version wrote to "price" and "category" — neither is a
  // column — so every service insert failed and nothing came through.
  // The helper swallowed the error, which is why it looked like the site
  // had no services rather than like a bug.
  if (p.services?.length) {
    const rows: any[] = [];

    for (const svc of p.services.slice(0, 40)) {
      const name = String(svc?.name ?? '').trim();
      if (!name) continue;

      const durationMinutes = num(svc.duration_minutes);
      const price = num(svc.price);

      // Tried in order of reliability: what the model said it is, then
      // the venue's own name, then whatever loose grouping it gave.
      let matched: any = null;
      for (const attempt of [svc.practice, name, svc.category].filter(Boolean)) {
        const { data: hit } = await supabase.rpc('match_practice', {
          p_phrase: String(attempt),
        });
        if (hit?.[0]) { matched = hit[0]; break; }
      }

      // A partial match is the matcher saying "this phrase contains a
      // practice I know", which is not the same as "this phrase is that
      // practice". A sulphuric mineral soak contains a mineral soak and
      // is not one — applying it silently would lose the sulphur for
      // good, and nobody would ever know it was there.
      //
      // Same where the model itself was unsure. Left unmatched and
      // raised, because being unmatched is recoverable and being wrongly
      // matched is not.
      const uncertain = matched?.confidence === 'Partial'
        || svc.practice_confidence === 'Unsure';

      if (matched && uncertain) {
        await supabase.rpc('note_practice_candidate', {
          p_phrase: String(svc.practice ?? name),
          p_venue_id: venue.id,
          p_url: draft.source_url,
          p_price: price,
          p_duration: durationMinutes,
          p_category_id: matched.category_id ?? null,
          p_near_practice_id: matched.practice_id,
          p_near_reason: svc.practice_confidence === 'Unsure'
            ? `The model was unsure. Nearest is ${matched.name}.`
            : `Contains "${matched.name}" plus "${matched.extra_words}". `
              + 'Kept apart in case the extra words change what it is.',
        });
        matched = null;
      }

      if (!matched) {
        // Kept and counted rather than dropped. 106 practices is thorough
        // and not complete, and the missing ones are the interesting ones.
        await supabase.rpc('note_practice_candidate', {
          p_phrase: svc.practice ? String(svc.practice) : name,
          p_venue_id: venue.id,
          p_url: draft.source_url,
          p_price: price,
          p_duration: durationMinutes,
          p_category_id: null,
        });
      }

      rows.push({
        venue_id: venue.id,
        name,
        website_display_name: name,
        description: svc.description ?? null,
        category_id: matched?.category_id ?? null,
        practice_id: matched?.practice_id ?? null,
        duration_minutes: durationMinutes,
        base_price: price,
        currency: svc.currency ?? p.price_currency ?? null,
        // A menu saying "from 450,000" is a starting price, and treating
        // it as fixed misquotes the venue.
        price_is_from: svc.price_is_from === true,
        price_range_low: num(svc.price_low),
        price_range_high: num(svc.price_high),
        duration_options: Array.isArray(svc.duration_options)
          ? svc.duration_options.map((d: any) => String(d)) : null,
        couples_available: svc.couples_available === true ? true : null,
        available_in_room: svc.in_room === true ? true : null,
        display_order: rows.length + 1,
      });
    }

    if (rows.length) {
      const { error } = await supabase.from('venue_services').insert(rows);
      // Reported rather than swallowed. A silent failure here is what hid
      // the last one.
      if (error) console.error('venue_services insert failed:', error.message);
    }
  }

  // Their policies, kept as their document rather than ours.
  for (const pol of p.policies ?? []) {
    if (!pol?.text) continue;
    await supabase.from('venue_documents').insert({
      venue_id: venue.id,
      name: pol.type ? `${pol.type} (from their site)` : 'Policy',
      document_type: /cancel/i.test(pol.type ?? '') ? 'Cancellation policy'
        : /rule/i.test(pol.type ?? '') ? 'House rules'
        : /book|payment/i.test(pol.type ?? '') ? 'Booking terms' : 'Other',
      extracted_text: pol.text,
      source_url: draft.source_url,
      origin: 'Extracted',
    });
  }

  // Facilities matched against the catalogue, including synonyms.
  // Anything unrecognised is recorded as a candidate rather than dropped:
  // a phrase one venue uses is their wording, one twenty venues use is a
  // gap in the catalogue, and a meditation cave in rural Mexico is
  // neither noise nor a mistake.
  if (p.facilities?.length) {
    const rows: any[] = [];
    for (const raw of p.facilities.slice(0, 80)) {
      const phrase = String(raw ?? '').trim();
      if (!phrase || phrase.length > 80) continue;

      const { data: hit } = await supabase.rpc('match_facility', {
        p_phrase: phrase, p_scope: 'Venue',
      });

      if (hit?.[0]?.facility_item_id) {
        rows.push({ venue_id: venue.id, facility_item_id: hit[0].facility_item_id });
      } else {
        await supabase.rpc('note_facility_candidate', {
          p_phrase: phrase, p_scope: 'Venue',
          p_venue_id: venue.id, p_url: draft.source_url,
        });
      }
    }
    if (rows.length) {
      await supabase.from('venue_facilities')
        .upsert(rows, { onConflict: 'venue_id,facility_item_id', ignoreDuplicates: true });
    }
  }

  // Settings matched from their own words.
  const locationText = [p.setting_headline, p.venue_short_description]
    .filter(Boolean).join(' ');
  if (locationText) {
    const { data: matched } = await supabase.rpc('match_settings', { p_text: locationText });
    if (matched?.length) {
      await supabase.from('venue_setting_links').upsert(
        matched.map((m: any, i: number) => ({
          venue_id: venue.id, setting_id: m.setting_id, is_primary: i === 0,
          relation: 'Immediate', source: 'Website',
          evidence: `Matched on "${m.matched_on}"`,
        })), { onConflict: 'venue_id,setting_id', ignoreDuplicates: true });
    }
  }

  await supabase.from('venue_intake_drafts').update({
    status: 'Accepted', venue_id: venue.id, accepted_at: new Date().toISOString(),
  }).eq('id', id);

  revalidatePath('/venues');
  return {
    ok: true, venueId: venue.id,
    message: `${name} created${!city?.id && p.city ? ` — "${p.city}" did not match a known city` : ''}.`,
  };
}

export async function discardDraft(id: number): Promise<Result> {
  const supabase = await createClient();
  await supabase.from('venue_intake_drafts').update({ status: 'Discarded' }).eq('id', id);
  revalidatePath('/venues/new');
  return { ok: true };
}

/* ── re-reading an existing venue ────────────────────────────────── */

/** Reads a venue's site again and reports what differs.
 *
 *  Nothing is written. A venue that has redesigned, added a space or
 *  changed its rates should be re-read, but a re-read that silently
 *  overwrote a corrected record would undo the checking that made it
 *  correct. */
export async function rereadVenue(venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { data: venue } = await supabase
    .from('venues').select('id,venue_name,website_url').eq('id', venueId).single();

  if (!venue) return { ok: false, error: 'Venue not found.' };
  if (!venue.website_url) {
    return { ok: false, error: `${venue.venue_name} has no website recorded.` };
  }

  const result = await readVenueFromUrl(venue.website_url, undefined, venueId);
  // Backfill the local area on every re-read, so venues processed before
  // this existed pick it up. Deduped; never blocks the re-read.
  await backfillLocalArea(venueId);
  return result;
}

/** What a re-read found that the venue does not currently say.
 *
 *  Only fields that differ, and only where the new value is not empty —
 *  a site that has dropped a paragraph should not empty a field somebody
 *  filled in by hand. */
export async function draftChanges(draftId: number) {
  const supabase = await createClient();

  const { data: draft } = await supabase
    .from('venue_intake_drafts').select('*').eq('id', draftId).single();
  if (!draft?.payload) return [];

  const venueId = draft.refreshes_venue_id ?? draft.venue_id;
  if (!venueId) return [];

  const { data: venue } = await supabase
    .from('venues').select('*').eq('id', venueId).single();
  if (!venue) return [];

  const p = draft.payload as any;
  const compare: [string, string, unknown][] = [
    ['venue_name', 'Name', p.venue_name],
    ['venue_short_description', 'Description', p.venue_short_description],
    ['setting_headline', 'Setting', p.setting_headline],
    ['street_address', 'Address', p.street_address],
    ['contact_phone', 'Phone', p.contact_phone],
    ['contact_email', 'Email', p.contact_email],
    ['max_guests', 'Maximum guests', p.max_guests],
    ['total_bedrooms', 'Bedrooms', p.total_bedrooms],
    ['total_bathrooms', 'Bathrooms', p.total_bathrooms],
    ['price_from', 'From price', p.price_from],
    ['price_currency', 'Currency', p.price_currency],
    ['instagram_url', 'Instagram', p.instagram_url],
    ['facebook_url', 'Facebook', p.facebook_url],
    ['youtube_url', 'YouTube', p.youtube_url],
    ['tripadvisor_url', 'TripAdvisor', p.tripadvisor_url],
    ['booking_engine_url', 'Booking engine', p.booking_engine_url],
    ['whatsapp_number', 'WhatsApp', p.whatsapp_number],
  ];

  const changes = compare
    .filter(([col, , value]) => {
      if (value === null || value === undefined || value === '') return false;
      const current = (venue as any)[col];
      if (current === null || current === undefined || current === '') return true;
      return String(current).trim() !== String(value).trim();
    })
    .map(([col, label, value]) => ({
      column: col,
      label,
      current: (venue as any)[col] ?? null,
      proposed: value,
      isNew: (venue as any)[col] === null || (venue as any)[col] === '',
    }));

  return changes;
}

/** Applies chosen fields from a re-read onto the venue it refreshes. */
export async function applyChanges(
  draftId: number, columns: string[]
): Promise<Result> {
  if (!columns.length) return { ok: true, message: 'Nothing selected.' };

  const supabase = await createClient();
  const { data: draft } = await supabase
    .from('venue_intake_drafts').select('*').eq('id', draftId).single();
  if (!draft?.payload) return { ok: false, error: 'Nothing to apply.' };

  const venueId = draft.refreshes_venue_id ?? draft.venue_id;
  if (!venueId) return { ok: false, error: 'This draft is not attached to a venue.' };

  const p = draft.payload as any;
  const numeric = new Set(['max_guests', 'total_bedrooms', 'total_bathrooms',
                           'price_from', 'established_year', 'property_size']);

  const patch: Record<string, unknown> = {};
  for (const col of columns) {
    const value = p[col];
    if (value === null || value === undefined || value === '') continue;
    patch[col] = numeric.has(col) ? Number(value) : value;
  }

  if (!Object.keys(patch).length) return { ok: true, message: 'Nothing to apply.' };

  const { error } = await supabase.from('venues').update(patch).eq('id', venueId);
  if (error) return { ok: false, error: error.message };

  await supabase.from('venue_intake_drafts')
    .update({ status: 'Accepted', accepted_at: new Date().toISOString() })
    .eq('id', draftId);

  revalidatePath(`/venues/${venueId}/details`);
  revalidatePath('/venues/intake');
  return {
    ok: true, venueId,
    message: `${Object.keys(patch).length} field${Object.keys(patch).length === 1 ? '' : 's'} updated.`,
  };
}

export async function intakeHistory(status?: string) {
  const supabase = await createClient();
  let q = supabase.from('intake_history').select('*')
    .order('created_at', { ascending: false }).limit(200);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data } = await q;
  return data ?? [];
}

/* ── links, without paying ───────────────────────────────────────── */

const LINK_COLUMNS = [
  'instagram_url', 'facebook_url', 'linkedin_url', 'youtube_url', 'tiktok_url',
  'pinterest_url', 'tripadvisor_url', 'google_business_url', 'booking_engine_url',
  'whatsapp_number', 'other_links',
] as const;

/** Reads a site's links and nothing else.
 *
 *  Costs nothing: the links are sitting in the markup, and fetching a
 *  page is free. Only the model call costs, and no model is needed to
 *  read a URL — asking one to repeat a link back is a way of introducing
 *  typos into something already correct.
 *
 *  Useful on its own, and useful for records read before link extraction
 *  existed. */
export async function refreshLinks(
  target: { venueId?: number; draftId?: number }
): Promise<Result> {
  const supabase = await createClient();

  let url: string | null = null;
  let venueId = target.venueId ?? null;

  if (target.draftId) {
    const { data: d } = await supabase.from('venue_intake_drafts')
      .select('id,source_url,payload,venue_id,refreshes_venue_id')
      .eq('id', target.draftId).single();
    if (!d) return { ok: false, error: 'Draft not found.' };
    url = (d.payload as any)?.website_url ?? d.source_url;
    venueId = venueId ?? d.venue_id ?? d.refreshes_venue_id;
  } else if (venueId) {
    const { data: v } = await supabase.from('venues')
      .select('website_url').eq('id', venueId).single();
    url = v?.website_url ?? null;
  }

  if (!url) return { ok: false, error: 'No website address to read.' };
  const origin = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const page = await fetchPage(origin);
  if ('error' in page) {
    return { ok: false, error: `Could not read that page (${page.error}).` };
  }

  const links = extractLinks(page.html, origin);
  const found: Record<string, unknown> = { ...links.fields };
  if (links.whatsapp) found.whatsapp_number = links.whatsapp;
  if (links.other.length) found.other_links = links.other;

  if (!Object.keys(found).length) {
    return { ok: true, message: 'No links found on that page.' };
  }

  const names = Object.keys(found)
    .map((k) => k.replace(/_url$|_number$/, '').replace(/_/g, ' '))
    .join(', ');

  // Onto the draft, where there is one.
  if (target.draftId) {
    const { data: d } = await supabase.from('venue_intake_drafts')
      .select('payload').eq('id', target.draftId).single();
    await supabase.from('venue_intake_drafts')
      .update({ payload: { ...(d?.payload as any ?? {}), ...found } })
      .eq('id', target.draftId);
    revalidatePath('/venues/new');
  }

  // And onto the venue, but only filling blanks — a link corrected by
  // hand should not be replaced by one scraped from a footer.
  if (venueId) {
    const { data: v } = await supabase.from('venues')
      .select(LINK_COLUMNS.join(',')).eq('id', venueId).single();

    const patch: Record<string, unknown> = {};
    for (const [col, value] of Object.entries(found)) {
      if (!(v as any)?.[col]) patch[col] = value;
    }
    if (Object.keys(patch).length) {
      await supabase.from('venues').update(patch).eq('id', venueId);
      revalidatePath(`/venues/${venueId}/details`);
    }
  }

  return {
    ok: true,
    venueId: venueId ?? undefined,
    fields: found,
    message: `Found ${Object.keys(found).length}: ${names}. Nothing was spent — links are read `
      + 'from the page, not from a model.',
  };
}

/** The link pass, across every venue with a website.
 *
 *  Runs concurrently and without pacing, because consecutive venues are
 *  different domains — nothing is hit twice, so a courtesy delay would
 *  protect nobody and turn a free pass into an hour of waiting.
 *
 *  Free. No model is called; the links are read out of the markup. */
export async function batchRefreshLinks(limit = 40): Promise<Result> {
  const supabase = await createClient();

  const { data: venues } = await supabase
    .from('venues')
    .select('id,website_url')
    .not('website_url', 'is', null)
    .is('links_checked_at', null)
    .order('id')
    .limit(Math.min(limit, 100));

  if (!venues?.length) return { ok: true, message: 'Every venue with a website has been read.' };

  const CONCURRENCY = 6;
  let found = 0, blank = 0, failed = 0, links = 0;

  const readOne = async (v: { id: number; website_url: string }) => {
    const url = /^https?:\/\//i.test(v.website_url) ? v.website_url : `https://${v.website_url}`;
    const page = await fetchPage(url);

    if ('error' in page) {
      // Marked as checked even on failure, so the next batch moves on
      // rather than retrying the same unreachable site forever.
      await supabase.from('venues').update({
        links_checked_at: new Date().toISOString(), links_found: 0,
      }).eq('id', v.id);
      failed++;
      return;
    }

    const extracted = extractLinks(page.html, url);
    const patch: Record<string, unknown> = {
      links_checked_at: new Date().toISOString(),
    };

    const { data: current } = await supabase.from('venues')
      .select(LINK_COLUMNS.join(',')).eq('id', v.id).single();

    let count = 0;
    for (const [col, value] of Object.entries(extracted.fields)) {
      // Blanks only. A link corrected by hand should not be replaced by
      // one scraped from a footer.
      if (!(current as any)?.[col]) { patch[col] = value; count++; }
    }
    if (extracted.whatsapp && !(current as any)?.whatsapp_number) {
      patch.whatsapp_number = extracted.whatsapp; count++;
    }
    if (extracted.other.length && !(current as any)?.other_links) {
      patch.other_links = extracted.other; count++;
    }

    patch.links_found = count;
    await supabase.from('venues').update(patch).eq('id', v.id);

    count > 0 ? found++ : blank++;
    links += count;
  };

  for (let i = 0; i < venues.length; i += CONCURRENCY) {
    await Promise.all(venues.slice(i, i + CONCURRENCY).map((v: any) => readOne(v)));
  }

  revalidatePath('/venues/links');
  return {
    ok: true,
    message: `${links} link${links === 1 ? '' : 's'} across ${found} venue${found === 1 ? '' : 's'}`
      + `${blank ? `, ${blank} published none` : ''}`
      + `${failed ? `, ${failed} unreachable` : ''}. Nothing spent.`,
  };
}

/* ── editing services on a draft ─────────────────────────────────── */

/** One field on one service inside the payload.
 *
 *  Editable before acceptance, because a draft read from a site that
 *  publishes its prices on a page the crawl did not reach should not have
 *  to be re-read to have them typed in. */
export async function updateDraftService(
  draftId: number, index: number, field: string, value: unknown
): Promise<Result> {
  const allowed = new Set([
    'name', 'practice', 'duration_minutes', 'price', 'currency',
    'price_is_from', 'description', 'couples_available', 'in_room',
  ]);
  if (!allowed.has(field)) return { ok: false, error: `"${field}" is not editable.` };

  const supabase = await createClient();
  const { data: draft } = await supabase
    .from('venue_intake_drafts').select('payload').eq('id', draftId).single();
  if (!draft?.payload) return { ok: false, error: 'Draft not found.' };

  const payload = draft.payload as any;
  const services = [...(payload.services ?? [])];
  if (!services[index]) return { ok: false, error: 'That service is not in the draft.' };

  services[index] = { ...services[index], [field]: value };

  const { error } = await supabase.from('venue_intake_drafts')
    .update({ payload: { ...payload, services } }).eq('id', draftId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/venues/new');
  return { ok: true, fields: { services } };
}

/** Runs every service in a draft against the practice taxonomy.
 *
 *  Free — no model call. Drafts read before the taxonomy was wired in
 *  carry a loose category like "massage" or "spa treatment", which
 *  matches nothing; this resolves what it can and leaves the rest to be
 *  chosen by hand. */
export async function matchDraftServices(draftId: number): Promise<Result> {
  const supabase = await createClient();
  const { data: draft } = await supabase
    .from('venue_intake_drafts').select('payload').eq('id', draftId).single();
  if (!draft?.payload) return { ok: false, error: 'Draft not found.' };

  const payload = draft.payload as any;
  const services = [...(payload.services ?? [])];
  if (!services.length) return { ok: true, message: 'No services in this draft.' };

  let matched = 0;
  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    if (s.practice_id) { matched++; continue; }

    // The stated practice first, then the service name. "Sound Healing in
    // Quantum Dome" is a sound bath, and the name is the only clue.
    for (const attempt of [s.practice, s.name, s.category].filter(Boolean)) {
      const { data: hit } = await supabase.rpc('match_practice', {
        p_phrase: String(attempt),
      });
      if (hit?.[0]) {
        services[i] = {
          ...s,
          practice: hit[0].name,
          practice_id: hit[0].practice_id,
          category_name: hit[0].category_name,
          matched_on: hit[0].matched_on,
        };
        matched++;
        break;
      }
    }
  }

  await supabase.from('venue_intake_drafts')
    .update({ payload: { ...payload, services } }).eq('id', draftId);

  revalidatePath('/venues/new');
  return {
    ok: true,
    fields: { services },
    message: `${matched} of ${services.length} matched to a practice. `
      + 'Nothing spent — matching is a lookup, not a model.',
  };
}

export async function practiceOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('modality_practices')
    .select('id,name,category_id,modality_categories(name)')
    .order('name');
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.modality_categories?.name ?? '—',
  }));
}


/* ── read and create in one move ─────────────────────────────────── */

/** Reads a site and creates the venue, landing in the real record.
 *
 *  The draft screen had started to become a second venue editor — the
 *  same fields, edited in a different place, drifting apart. This makes
 *  the venue record the only place work happens, and leaves the draft as
 *  what it should always have been: the record of what a site said on a
 *  given day.
 *
 *  Nothing is lost by creating early. A venue arrives as Sourced, which
 *  is not published and not visible to anyone. */
export async function readAndCreate(
  rawUrl: string, pastedText?: string, force = false
): Promise<Result & { duplicates?: any[] }> {
  // Checked before the site is read, since the address alone is often
  // enough — and a read that is about to be discarded should not be paid
  // for.
  if (!force) {
    const supabase = await createClient();
    const { data: existing } = await supabase.rpc('find_similar_venues', {
      p_name: rawUrl.replace(/^https?:\/\/(www\.)?/, '').split('.')[0],
      p_website: rawUrl,
      p_email: null, p_phone: null, p_exclude_id: null,
    });

    // A shared domain is near proof. Anything weaker is raised after the
    // read, when the venue's real name is known.
    const strong = (existing ?? []).filter((d: any) =>
      (d.signals ?? []).includes('Same website'));

    if (strong.length) {
      return {
        ok: false,
        error: `That website already belongs to ${strong[0].venue_name}.`,
        duplicates: strong,
      };
    }
  }

  const read = await readVenueFromUrl(rawUrl, pastedText);
  if (!read.ok) return read;
  if (!read.draftId) return { ok: false, error: 'No draft was produced.' };

  // Checked again with the real name, which the address could not give.
  if (!force) {
    const supabase = await createClient();
    const { data: draft } = await supabase.from('venue_intake_drafts')
      .select('payload').eq('id', read.draftId).single();
    const p = draft?.payload as any;

    if (p?.venue_name) {
      const { data: similar } = await supabase.rpc('find_similar_venues', {
        p_name: p.venue_name,
        p_website: p.website_url ?? rawUrl,
        p_email: p.contact_email ?? null,
        p_phone: p.contact_phone ?? null,
        p_exclude_id: null,
      });

      const likely = (similar ?? []).filter((d: any) => Number(d.score) >= 0.45);
      if (likely.length) {
        return {
          ok: false,
          draftId: read.draftId,
          error: `${p.venue_name} may already be in the database.`,
          duplicates: likely,
        };
      }
    }
  }

  const created = await acceptDraft(read.draftId);
  if (!created.ok) return created;

  return {
    ok: true,
    venueId: created.venueId,
    draftId: read.draftId,
    message: created.message,
  };
}

/** What a read produced, for the banner on the venue record.
 *
 *  Shown once on arrival rather than as a permanent panel — the point is
 *  to say what came through and what needs a person, then get out of the
 *  way. */
export async function intakeSummary(venueId: number) {
  const supabase = await createClient();

  const { data: draft } = await supabase
    .from('venue_intake_drafts')
    .select('*')
    .or(`venue_id.eq.${venueId},refreshes_venue_id.eq.${venueId}`)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();

  if (!draft) return null;

  const [rooms, spaces, services, facilities, unmatchedServices] = await Promise.all([
    supabase.from('venue_room_types')
      .select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('venue_spaces')
      .select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('venue_services')
      .select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('venue_facilities')
      .select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('venue_services')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', venueId).is('practice_id', null),
  ]);

  return {
    draftId: draft.id,
    sourceUrl: draft.source_url,
    pagesRead: (draft.pages_read ?? []).length,
    pagesFailed: (draft.pages_failed ?? []).length,
    cost: draft.cost_usd,
    createdAt: draft.created_at,
    flags: draft.flags ?? [],
    counts: {
      rooms: rooms.count ?? 0,
      spaces: spaces.count ?? 0,
      services: services.count ?? 0,
      facilities: facilities.count ?? 0,
      unmatchedServices: unmatchedServices.count ?? 0,
    },
  };
}


/* ── brands with several locations ───────────────────────────────── */

/** Looks for other locations before reading anything.
 *
 *  A brand's home page describes the brand, not a venue. Reading it alone
 *  records an ethos and no address — and creates one record where there
 *  should be eight. */
export async function findLocations(rawUrl: string) {
  const url = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;

  const page = await fetchPage(url);
  if ('error' in page) return { ok: false as const, error: `Could not read that page.` };

  const locations = discoverLocations(page.html, url);
  if (!locations.length) return { ok: true as const, locations: [] };

  // Which are already recorded, so the same location is not created twice.
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('venues').select('id,venue_name,website_url')
    .not('website_url', 'is', null)
    .ilike('website_url', `%${new URL(url).hostname.replace(/^www\./, '')}%`);

  const known = new Map(
    (existing ?? []).map((v: any) => [
      String(v.website_url).replace(/\/$/, '').toLowerCase(), v,
    ]));

  return {
    ok: true as const,
    locations: locations.map((l) => ({
      ...l,
      existing: known.get(l.url.toLowerCase()) ?? null,
    })),
  };
}

/** Reads several locations of one brand, creating a venue for each and a
 *  brand record above them.
 *
 *  Each location is a full venue — its own address, hours and services —
 *  because a guest searching Sydney must not be shown Melbourne. The
 *  brand exists because the commercial relationship does: one contract,
 *  one commission rate, and a brand that leaves takes every location. */
export async function readBrandLocations(
  brandUrl: string, locationUrls: string[], brandName?: string
): Promise<Result & { brandId?: number; created?: number }> {
  if (!locationUrls.length) return { ok: false, error: 'No locations chosen.' };

  const supabase = await createClient();
  const domain = new URL(
    /^https?:\/\//i.test(brandUrl) ? brandUrl : `https://${brandUrl}`,
  ).hostname.replace(/^www\./, '');

  // The brand's own page, read for what it calls itself and what its mark
  // looks like. A domain is an address, not a name — which is how
  // beaire.com became a brand called "Beaire".
  const brandPage = await fetchPage(
    /^https?:\/\//i.test(brandUrl) ? brandUrl : `https://${brandUrl}`);

  const readName = 'html' in brandPage
    ? findBrandName(brandPage.html, domain) : null;
  const brandLogo = 'html' in brandPage
    ? findLogo(brandPage.html, `https://${domain}`) : { url: null };

  const name = brandName?.trim() || readName
    || domain.replace(/\.(com|net|org|co)(\.[a-z]{2})?$/, '');

  // Slugged from the name rather than the domain, so the brand reads as
  // itself in a URL as well as on screen.
  const slug = name.toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 60)
    || domain.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  const { data: brand } = await supabase.from('venue_brands').upsert({
    name,
    slug,
    website_url: `https://${domain}`,
    location_count: locationUrls.length,
    logo_url: brandLogo.url,
    brand_kind: 'Venue brand',
  }, { onConflict: 'slug' }).select('id,name').single();

  if (!brand) return { ok: false, error: 'Could not record the brand.' };

  let created = 0;
  const failures: string[] = [];

  let adopted = 0;

  for (const url of locationUrls) {
    // Each location read on its own, since each has its own address,
    // hours and often its own services.
    const read = await readVenueFromUrl(url);
    if (!read.ok || !read.draftId) {
      failures.push(url);
      continue;
    }

    // Look before creating. Thirty-five Six Senses records already exist
    // in the database, and a brand read that ignored them would produce
    // thirty-five more beside them — which is worse than not reading at
    // all, because now there are two of everything.
    const readName = String(
      (read as any).fields?.venue_name
      ?? (await supabase.from('venue_intake_drafts')
            .select('payload').eq('id', read.draftId).single()
         ).data?.payload?.venue_name ?? '',
    ).trim();

    let existingId: number | null = null;

    if (readName) {
      const { data: hit } = await supabase.rpc('find_similar_venues', {
        p_name: readName,
        p_website: url,
        p_email: null,
        p_phone: null,
      });

      // Only where the match is strong. A near miss creates a wrong merge,
      // and a wrong merge is harder to undo than a duplicate row.
      const best = (hit ?? [])[0];
      if (best && Number(best.score) >= 0.75) existingId = best.venue_id;
    }

    const accepted = existingId
      ? await mergeDraftInto(read.draftId, existingId)
      : await acceptDraft(read.draftId);

    if (!accepted.ok || !accepted.venueId) {
      failures.push(url);
      continue;
    }

    if (existingId) adopted += 1;

    // The location's own page URL, not the brand's — so a re-read goes
    // back to the right page.
    await supabase.from('venues').update({
      brand_id: brand.id,
      website_url: url,
      created_via: 'Brand location',
      created_via_detail: `One of ${locationUrls.length} locations read from ${domain}`,
    }).eq('id', accepted.venueId);

    created++;
  }

  revalidatePath('/venues');
  return {
    ok: true,
    brandId: brand.id,
    created,
    message: `${brand.name}: ${created - adopted} created`
      + `${adopted ? `, ${adopted} matched to records already here` : ''}`
      + `${failures.length ? `, ${failures.length} could not be read` : ''}.`,
  };
}

/** Finds a logo without calling the model.
 *
 *  The extraction is pure HTML parsing, so this costs a page fetch and
 *  nothing else — where a full re-read of 1,295 venues would be about
 *  $50, this is free. Worth having as its own pass rather than a reason
 *  to re-read everything.
 */
export async function readLogoOnly(venueId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: venue } = await supabase.from('venues')
    .select('id,venue_name,website_url,logo_url').eq('id', venueId).single();

  if (!venue?.website_url) {
    return { ok: false, error: 'No website recorded for that venue.' };
  }

  const page = await fetchPage(venue.website_url);
  if ('error' in page) {
    return { ok: false, error: `Could not read their site (${page.error}).` };
  }

  const logo = findLogo(page.html, venue.website_url);
  if (!logo.url) {
    return { ok: false, error: 'No logo found in their markup.' };
  }

  await supabase.from('venues').update({
    logo_url: logo.url,
    logo_source: 'Read from their site',
  }).eq('id', venueId);

  revalidatePath(`/venues/${venueId}/details`);
  return { ok: true, message: `Found via ${logo.source?.toLowerCase()}.` };
}

/** The same across many venues.
 *
 *  Batched and paced, because a hundred simultaneous fetches looks like
 *  an attack to whoever is hosting them. */
export async function readLogosForMany(limit = 40): Promise<Result> {
  const supabase = await createClient();

  const { data: venues } = await supabase.from('venues')
    .select('id')
    .not('website_url', 'is', null)
    .is('logo_url', null)
    .is('archived_at', null)
    .limit(limit);

  if (!venues?.length) return { ok: true, message: 'Nothing left to look at.' };

  let found = 0, missing = 0;
  for (const v of venues) {
    const r = await readLogoOnly(v.id);
    r.ok ? found++ : missing++;
    await new Promise((s) => setTimeout(s, 250));
  }

  revalidatePath('/venues');
  return {
    ok: true,
    message: `${found} found, ${missing} without one, out of ${venues.length}.`,
  };
}

/** Reads one page into a venue that already exists.
 *
 *  Different from a re-read, which crawls a whole site and replaces the
 *  picture. This takes a single page — a spa menu, a rates page, a room
 *  list — and adds what it finds to the venue as it stands.
 *
 *  For the case where somebody is looking at a page and can see it holds
 *  forty treatments the record does not have. Re-reading the whole site
 *  to get them would cost more and change more than intended.
 */
export async function readPageInto(
  venueId: number,
  rawUrl: string,
  what: 'services' | 'packages' | 'rooms' | 'spaces' | 'facilities' = 'services',
  /** Follow the links on that page as well.
   *
   *  A wellness tab is usually a contents page — it links to the spa, the
   *  gym and the pool, and the services live on those rather than on it.
   *  Reading only the page somebody pasted would find headings and no
   *  treatments. */
  followLinks = false,
  /** Attach what is found to a space.
   *
   *  Reading the Bamford page should put those treatments in the Bamford
   *  spa, not loose on the venue. A hotel with a spa, a gym and a studio
   *  has three menus, and services with no space cannot be shown under
   *  the right heading. */
  spaceId: number | null = null,
): Promise<Result> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY is not set in Vercel.' };

  const supabase = await createClient();
  const { data: venue } = await supabase.from('venues')
    .select('id,venue_name').eq('id', venueId).single();
  if (!venue) return { ok: false, error: 'Venue not found.' };

  let url: string;
  try {
    url = new URL(rawUrl.trim().startsWith('http') ? rawUrl.trim()
                                                   : `https://${rawUrl.trim()}`).href;
  } catch {
    return { ok: false, error: 'That does not look like a web address.' };
  }

  const page = await fetchPage(url);
  if ('error' in page) {
    return { ok: false, error: `Could not read that page (${page.error}).` };
  }

  let text = pageToText(page.html).slice(0, 60_000);
  const pagesRead: string[] = [url];

  if (followLinks) {
    // Links beneath the same path, which is what a section looks like on
    // almost every site — /melbourne/do/wellness links to
    // /melbourne/do/bamford-wellness-spa and /melbourne/do/pool.
    const base = new URL(url);
    const parent = base.pathname.replace(/\/[^/]*$/, '');

    const found = new Set<string>();
    for (const m of page.html.matchAll(/href=["']([^"'#?]+)["']/gi)) {
      try {
        const u = new URL(m[1], url);
        if (u.host !== base.host) continue;
        if (u.pathname === base.pathname) continue;
        // Under the same parent, or one level deeper than it.
        if (!u.pathname.startsWith(parent)) continue;
        if (/\.(jpg|jpeg|png|gif|svg|pdf|webp|css|js)$/i.test(u.pathname)) continue;
        found.add(u.href.replace(/\/$/, ''));
      } catch { /* a malformed href is not worth failing over */ }
    }

    // Bounded. Six pages is enough for a wellness section and keeps a
    // single read from becoming a crawl of the whole site.
    for (const link of Array.from(found).slice(0, 6)) {
      const sub = await fetchPage(link);
      if ('error' in sub) continue;
      const subText = pageToText(sub.html).slice(0, 25_000);
      if (subText.length < 200) continue;
      text += `\n\n--- ${link} ---\n${subText}`;
      pagesRead.push(link);
    }
  }

  if (text.length < 200) {
    return { ok: false, error: 'That page has almost no text on it.' };
  }

  // Narrow prompts, because a page asked for everything returns a worse
  // answer about the thing that was actually wanted.
  const asks: Record<string, string> = {
    services: [
      'Return JSON: { "services": [ ... ] }',
      '',
      'Each service:',
      '  "name": their name for it, as written',
      '  "practice": what it actually IS in plain words. Read the',
      '    description before deciding. Be exact rather than close — if it',
      '    is more specific than a general practice, say the specific',
      '    thing. Being unmatched is recoverable; being wrongly matched is',
      '    not.',
      '  "practice_confidence": "Certain", "Likely" or "Unsure"',
      '  "description": theirs, condensed if long',
      '  "duration_minutes": number only',
      '  "duration_options": other lengths offered',
      '  "base_price": number only, no symbol',
      '  "currency": three letters',
      '  "price_is_from": true where the price is a starting point',
      '  "couples_available": true only if stated',
      '  "available_in_room": true only if stated',
      '',
      'Only treatments and services. Not packages of several treatments —',
      'those are a different thing. Not facilities. Not opening hours.',
    ].join('\n'),

    packages: [
      'Return JSON: { "packages": [ ... ] }',
      '',
      'Each package — a named thing at one price made of several parts:',
      '  "name", "tagline", "description"',
      '  "price": number only, "currency": three letters',
      '  "duration_label": as written, "total_duration_minutes": in minutes',
      '  "items": [ { "name": each part separately, "duration_minutes" } ]',
      '  "available_months": [1-12] where seasonal',
      '',
      'A ritual of three treatments is three items, not one line of prose.',
      'A single treatment at one price is a service, not a package.',
    ].join('\n'),

    rooms: [
      'Return JSON: { "room_types": [ ... ] }',
      '  "name", "quantity", "sleeps", "bed_configuration",',
      '  "bathroom_type", "room_size", "room_size_unit", "description",',
      '  "room_amenities": [ ], "is_accessible", "step_free_access"',
    ].join('\n'),

    facilities: [
      'Return JSON: { "facilities": [ ... ] }',
      '',
      'Each facility — a thing the venue HAS rather than a treatment it',
      'sells. A sauna, a vitality pool, a gym, a steam room.',
      '  "name": as they call it',
      '  "description": theirs, condensed',
      '  "access_basis": exactly one of "Included with a stay",',
      '    "Included with a treatment", "Included with a day pass",',
      '    "Charged per use", "Members only", "By arrangement" — only',
      '    where the page says so plainly, null otherwise.',
      '  "price": number only, where charged',
      '  "operating_hours": as written',
      '  "temperature": where stated, for pools and saunas',
      '  "day_visitors_welcome": true only if stated',
      '',
      'A treatment somebody books is a service, not a facility. A sauna',
      'they walk into is a facility. If the page charges for it by the',
      'hour and books a therapist, it is a service.',
    ].join('\n'),

    spaces: [
      'Return JSON: { "spaces": [ ... ] }',
      '  "name", "space_type", "description", "area", "area_unit",',
      '  "capacity", "is_outdoor", "is_covered", "flooring",',
      '  "equipment_provided": [ ], "suitable_for": [ ]',
    ].join('\n'),
  };

  const prompt = [
    `This is one page from ${venue.venue_name}.`,
    '',
    asks[what],
    '',
    'Return null for anything the page does not say. Do not infer, do not',
    'fill gaps from what is usual. An empty list is a valid answer.',
    'Return JSON only, no other text.',
    '',
    '--- PAGE ---',
    text,
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: INTAKE_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `The model refused that (${res.status}).` };
  }

  const body = await res.json();
  const raw = (body.content ?? [])
    .filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');

  let parsed: any;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { ok: false, error: 'The model did not return usable JSON.' };
  }

  const usage = body.usage ?? { input_tokens: 0, output_tokens: 0 };
  let added = 0;

  if (what === 'services') {
    for (const svc of (parsed.services ?? []) as any[]) {
      if (!svc?.name) continue;

      // Same care as a full read: a partial match is raised rather than
      // applied, because a specific thing recorded as a general one loses
      // the detail for good.
      let matched: any = null;
      for (const attempt of [svc.practice, svc.name].filter(Boolean)) {
        const { data: hit } = await supabase.rpc('match_practice', {
          p_phrase: String(attempt),
        });
        if (hit?.[0]) { matched = hit[0]; break; }
      }

      const uncertain = matched?.confidence === 'Partial'
        || svc.practice_confidence === 'Unsure';

      if (matched && uncertain) {
        await supabase.rpc('note_practice_candidate', {
          p_phrase: String(svc.practice ?? svc.name),
          p_venue_id: venueId,
          p_url: url,
          p_price: num(svc.base_price),
          p_duration: num(svc.duration_minutes),
          p_category_id: matched.category_id ?? null,
          p_near_practice_id: matched.practice_id,
          p_near_reason: `Contains "${matched.name}" plus "${matched.extra_words}".`,
        });
        matched = null;
      }

      const { error } = await supabase.from('venue_services').insert({
        venue_id: venueId,
        name: svc.name,
        website_display_name: svc.name,
        description: svc.description ?? null,
        practice_id: matched?.practice_id ?? null,
        category_id: matched?.category_id ?? null,
        duration_minutes: num(svc.duration_minutes),
        duration_options: arr(svc.duration_options),
        base_price: num(svc.base_price),
        currency: svc.currency ?? null,
        price_is_from: bool(svc.price_is_from),
        couples_available: bool(svc.couples_available),
        available_in_room: bool(svc.available_in_room),
        space_id: spaceId,
        // The operator, inherited from the space. A Bamford treatment is
        // a Bamford treatment whichever hotel it is in.
        operator_brand_id: spaceId
          ? (await supabase.from('venue_spaces')
              .select('operator_brand_id').eq('id', spaceId).maybeSingle()
            ).data?.operator_brand_id ?? null
          : null,
      });
      if (!error) added += 1;
    }
  }

  if (what === 'packages') {
    for (const pk of (parsed.packages ?? []) as any[]) {
      if (!pk?.name) continue;
      const { data: pkg } = await supabase.from('venue_packages').insert({
        venue_id: venueId,
        space_id: spaceId,
        name: pk.name,
        tagline: pk.tagline ?? null,
        description: pk.description ?? null,
        duration_label: pk.duration_label ?? null,
        total_duration_minutes: num(pk.total_duration_minutes),
        price: num(pk.price),
        currency: pk.currency ?? null,
        available_months: Array.isArray(pk.available_months) ? pk.available_months : null,
      }).select('id').single();

      if (!pkg) continue;
      added += 1;

      let order = 0;
      for (const item of (pk.items ?? []) as any[]) {
        if (!item?.name) continue;
        order += 10;
        const { data: service } = await supabase.from('venue_services')
          .select('id').eq('venue_id', venueId).ilike('name', item.name)
          .limit(1).maybeSingle();

        await supabase.from('venue_package_items').insert({
          package_id: pkg.id,
          service_id: service?.id ?? null,
          label: service?.id ? null : item.name,
          duration_minutes: num(item.duration_minutes),
          display_order: order,
        });
      }
    }
  }

  if (what === 'rooms') {
    for (const rm of (parsed.room_types ?? []) as any[]) {
      if (!rm?.name) continue;
      const { error } = await supabase.from('venue_room_types').insert({
        venue_id: venueId,
        name: rm.name,
        quantity: num(rm.quantity),
        sleeps: num(rm.sleeps),
        bed_configuration: rm.bed_configuration ?? null,
        bathroom_type: rm.bathroom_type ?? null,
        room_size: num(rm.room_size),
        room_size_unit: rm.room_size_unit ?? null,
        description: rm.description ?? null,
        room_amenities: arr(rm.room_amenities),
        is_accessible: bool(rm.is_accessible),
        step_free_access: bool(rm.step_free_access),
      });
      if (!error) added += 1;
    }
  }

  if (what === 'facilities') {
    for (const f of (parsed.facilities ?? []) as any[]) {
      if (!f?.name) continue;

      // Matched to the catalogue, so a sauna at one venue is the same
      // sauna as at another and both are findable by the same filter.
      const { data: item } = await supabase.from('facility_items')
        .select('id').ilike('name', f.name).limit(1).maybeSingle();

      const { data: made } = item
        ? { data: item }
        : await supabase.from('facility_items')
            .insert({ name: f.name,
                      slug: String(f.name).toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-').slice(0, 60) })
            .select('id').single();

      if (!made?.id) continue;

      const { error } = await supabase.from('venue_facilities').insert({
        venue_id: venueId,
        facility_item_id: made.id,
        website_title: f.name,
        website_description: f.description ?? null,
        access_basis: f.access_basis ?? null,
        price: num(f.price),
        operating_hours: f.operating_hours ?? null,
        temperature: f.temperature ?? null,
        day_visitors_welcome: bool(f.day_visitors_welcome),
      });
      if (!error) added += 1;
    }
  }

  if (what === 'spaces') {
    for (const sp of (parsed.spaces ?? []) as any[]) {
      if (!sp?.name) continue;
      const { error } = await supabase.from('venue_spaces').insert({
        venue_id: venueId,
        name: sp.name,
        space_type: sp.space_type ?? null,
        description: sp.description ?? null,
        area: num(sp.area),
        area_unit: sp.area_unit ?? null,
        capacity: num(sp.capacity),
        is_outdoor: bool(sp.is_outdoor),
        is_covered: bool(sp.is_covered),
        flooring: sp.flooring ?? null,
        equipment_provided: arr(sp.equipment_provided),
        suitable_for: arr(sp.suitable_for),
      });
      if (!error) added += 1;
    }
  }

  // Recorded as its own kind of read, so the Site reads log distinguishes
  // a targeted page from a full crawl.
  await supabase.from('venue_intake_drafts').insert({
    venue_id: venueId,
    refreshes_venue_id: venueId,
    source_url: url,
    run_kind: followLinks
      ? `Section — ${what} (${pagesRead.length} pages)`
      : `One page — ${what}`,
    status: 'Applied',
    payload: parsed,
    pages_read: pagesRead,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: cost(usage.input_tokens, usage.output_tokens),
  });

  revalidatePath(`/venues/${venueId}/services`);
  revalidatePath(`/venues/${venueId}/pricing`);

  return {
    ok: true,
    message: added
      ? `${added} added from ${pagesRead.length} page${pagesRead.length === 1 ? '' : 's'}.`
      : `Nothing found across ${pagesRead.length} page${pagesRead.length === 1 ? '' : 's'} that fits.`,
  };
}

/** Fills an existing venue from a draft, rather than creating a second.
 *
 *  Only blanks. A record somebody has already worked on should gain what
 *  it was missing and keep what it has — a read is evidence, not a
 *  correction, and the venue may have been fixed by hand for a reason.
 */
export async function mergeDraftInto(
  draftId: number, venueId: number
): Promise<Result & { venueId?: number }> {
  const supabase = await createClient();

  const { data: draft } = await supabase.from('venue_intake_drafts')
    .select('*').eq('id', draftId).single();
  if (!draft?.payload) return { ok: false, error: 'That read has no answer to apply.' };

  const { data: venue } = await supabase.from('venues')
    .select('*').eq('id', venueId).single();
  if (!venue) return { ok: false, error: 'That venue no longer exists.' };

  const payload = draft.payload as Record<string, any>;

  // Columns the read produces that the venue does not already answer.
  const { data: columns } = await supabase.rpc('venue_columns');
  const known = new Set<string>(
    (columns ?? []).map((c: any) => c.column_name ?? c));

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && !value.length) continue;
    if (known.size && !known.has(key)) continue;
    // The venue's own answer wins.
    if (venue[key] !== null && venue[key] !== undefined && venue[key] !== '') continue;
    patch[key] = value;
  }

  patch.last_intake_at = new Date().toISOString();
  patch.last_intake_draft_id = draftId;

  const { error } = await supabase.from('venues').update(patch).eq('id', venueId);
  if (error) return { ok: false, error: error.message };

  await supabase.from('venue_intake_drafts').update({
    status: 'Applied',
    venue_id: venueId,
    refreshes_venue_id: venueId,
  }).eq('id', draftId);

  return {
    ok: true,
    venueId,
    message: `${Object.keys(patch).length - 2} blanks filled on the existing record.`,
  };
}
