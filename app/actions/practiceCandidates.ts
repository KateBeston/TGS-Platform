'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function practiceCandidates(status = 'Pending') {
  const supabase = await createClient();
  const { data } = await supabase
    .from('practice_candidates')
    .select('*, modality_practices(name), modality_categories(name), '
          + 'near:near_practice_id(id,name,category_id)')
    .eq('status', status)
    .order('times_seen', { ascending: false })
    .order('phrase')
    .limit(300);
  return data ?? [];
}

export async function taxonomy() {
  const supabase = await createClient();
  const [{ data: practices }, { data: categories }] = await Promise.all([
    supabase.from('modality_practices')
      .select('id,name,category_id,synonyms,modality_categories(name)').order('name'),
    supabase.from('modality_categories').select('id,name').order('display_order'),
  ]);
  return { practices: practices ?? [], categories: categories ?? [] };
}

/** Another wording of a practice already in the taxonomy.
 *
 *  "Abhyanga" and "Ayurvedic oil massage" are the same thing, and
 *  recording one as a wording of the other means every venue read
 *  afterwards matches it. */
export async function practiceAsAlias(
  candidateId: number, practiceId: number, note?: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_practice_alias', {
    p_candidate_id: candidateId, p_practice_id: practiceId, p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/catalogues/practices');
  return { ok: true, message: 'Recorded as another wording. It will match from now on.' };
}

export async function practiceAsNew(
  candidateId: number, categoryId: number, name: string
): Promise<Result> {
  const supabase = await createClient();

  const { data: c } = await supabase
    .from('practice_candidates').select('normalised').eq('id', candidateId).single();

  const slug = name.trim().toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);

  const { data: practice, error } = await supabase.from('modality_practices').insert({
    category_id: categoryId,
    name: name.trim(),
    slug,
    // The website's own wording, kept so the next venue phrasing it the
    // same way matches rather than raising the candidate again.
    synonyms: c?.normalised && c.normalised !== name.trim().toLowerCase()
      ? [c.normalised] : null,
  }).select('id').single();

  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'A practice with that name exists — record this as another wording instead.'
      : error.message };
  }

  // Flags carry across on acceptance. A practice added without them
  // arrives bare — and the ones being added are exactly the ones that
  // need them, because the taxonomy did not have them yet.
  const { data: full } = await supabase
    .from('practice_candidates').select('suggested_flags,flag_note')
    .eq('id', candidateId).single();

  if (full?.suggested_flags?.length) {
    const { data: types } = await supabase
      .from('practice_flag_types').select('id,slug')
      .in('slug', full.suggested_flags);

    if (types?.length) {
      await supabase.from('practice_flags').insert(
        types.map((t: any) => ({
          practice_id: practice.id,
          flag_type_id: t.id,
          detail: full.flag_note ?? null,
        })));

      // Keep the boolean gates in step for anything reading those.
      const slugs = new Set(full.suggested_flags);
      await supabase.from('modality_practices').update({
        legal_review: ['illegal-most','legality-varies','drug-interaction']
          .some((x) => slugs.has(x)) || null,
        cultural_gate: ['closed-practice','cultural-protocol']
          .some((x) => slugs.has(x)) || null,
        health_screening: ['medical-screening','cardiac-risk','psychological-risk',
                           'not-in-pregnancy','deaths-documented']
          .some((x) => slugs.has(x)) || null,
      }).eq('id', practice.id);
    }
  }

  await supabase.from('practice_candidates').update({
    status: 'Added', practice_id: practice.id, decided_at: new Date().toISOString(),
  }).eq('id', candidateId);

  revalidatePath('/settings/catalogues/practices');
  return { ok: true, message: `${name} added to the taxonomy.` };
}

export async function practiceReject(id: number, note?: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('practice_candidates').update({
    status: 'Rejected', decided_at: new Date().toISOString(), decided_note: note ?? null,
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/catalogues/practices');
  return { ok: true };
}

/** Accepts several at once, into one category.
 *
 *  Three categories are empty and each has ten suggestions waiting.
 *  Deciding on them one at a time is ten clicks to say the same thing. */
export async function practiceAcceptMany(
  ids: number[], categoryId?: number
): Promise<Result> {
  if (!ids.length) return { ok: true, message: 'Nothing selected.' };
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('practice_candidates')
    .select('id,phrase,normalised,suggested_category_id')
    .in('id', ids);

  let added = 0, failed = 0;
  for (const r of rows ?? []) {
    const cat = categoryId ?? r.suggested_category_id;
    if (!cat) { failed++; continue; }
    const res = await practiceAsNew(r.id, cat, r.phrase);
    res.ok ? added++ : failed++;
  }

  revalidatePath('/settings/catalogues/practices');
  return {
    ok: true,
    message: `${added} added${failed ? `, ${failed} could not be` : ''}.`,
  };
}

/* ── suggesting where something belongs ──────────────────────────── */

export type PracticeSuggestion = {
  practiceId: number | null;
  name: string;
  category: string;
  categoryId: number;
  why: string;
  confidence: 'Exact' | 'Close' | 'Category only';
};

/** What an unmatched service name might be.
 *
 *  Three levels, and the third is the useful one: even where no practice
 *  fits, the category usually can be worked out from a word — "massage"
 *  is Body Therapies whether or not the specific massage is catalogued.
 *  That turns "no idea" into "add it here", which is a much shorter
 *  decision. */
export async function suggestPractice(phrase: string): Promise<PracticeSuggestion[]> {
  const clean = phrase.toLowerCase().trim();
  if (!clean) return [];

  const supabase = await createClient();

  const [{ data: practices }, { data: categories }] = await Promise.all([
    supabase.from('modality_practices')
      .select('id,name,category_id,synonyms,modality_categories(name)'),
    supabase.from('modality_categories').select('id,name'),
  ]);

  const catName = new Map((categories ?? []).map((c: any) => [c.id, c.name]));
  const catId = new Map((categories ?? []).map((c: any) => [c.name, c.id]));
  const out: PracticeSuggestion[] = [];

  const words = clean.split(/\s+/).filter((w) => w.length > 3);

  // Anything sharing a distinctive word. "Hot stone massage" finds every
  // massage before anything else.
  for (const p of practices ?? []) {
    const name = String(p.name).toLowerCase();
    const shared = words.filter((w) => name.includes(w));
    if (!shared.length) continue;
    out.push({
      practiceId: p.id,
      name: p.name,
      category: (p as any).modality_categories?.name ?? '—',
      categoryId: p.category_id,
      why: `shares "${shared.join('", "')}"`,
      confidence: name === clean ? 'Exact' : 'Close',
    });
  }

  // Where nothing shares a word, the category can still usually be told
  // from one. This is what makes "add it" a short decision rather than a
  // scroll through eighteen.
  if (out.length < 3) {
    const hints: [RegExp, string][] = [
      [/massage|bodywork|reflexolog|cupping|gua sha|osteopath|chiropract|lomi|shiatsu|rolf|scrub|wrap|facial/i,
       'Body Therapies & Bodywork'],
      [/sound|gong|bowl|kirtan|chant|frequenc|vibration|tuning/i, 'Sound & Vibrational'],
      [/yoga|pilates|movement|stretch|barre|dance|qigong|tai chi/i, 'Yoga & Movement'],
      [/breath|pranayama|wim hof|hyperventil/i, 'Breathwork'],
      [/meditat|mindful|vipassana|silence|silent|nidra/i, 'Meditation & Mindfulness'],
      [/sauna|steam|onsen|thermal|plunge|ice|hydro|banya|hammam|watsu|float/i,
       'Thermal & Hydrotherapy'],
      [/ayurved|abhyanga|shirodhara|panchakarma|marma|dosha|udvartana|basti|nasya/i,
       'Ayurveda'],
      [/reiki|energy|chakra|aura|crystal|kundalini|theta|pranic|akashic/i,
       'Energy & Esoteric'],
      [/fast|cleanse|detox|juice|nutrition|diet|colonic|gut/i, 'Nutrition & Cleansing'],
      [/ceremon|cacao|plant medicine|ayahuasca|kambo|rapé|rape|san pedro|psilocyb/i,
       'Plant Medicine & Ceremony'],
      [/forest|nature|bathing|foraging|wild|earthing|stargaz|garden/i, 'Nature Immersion'],
      [/circle|constellation|relating|group|couples|men|women|communication/i,
       'Relational & Group Work'],
      [/art|paint|clay|ceramic|writ|journal|sing|voice|drum|drama|creative|ecstatic/i,
       'Creative & Expressive Arts'],
      [/shaman|indigenous|temazcal|sweat lodge|smudg|ancestral|aboriginal|māori|maori/i,
       'Indigenous & Earth Traditions'],
      [/cryo|red light|oxygen|hyperbaric|iv |infusion|biohack|peptide/i, 'Modern Wellness'],
      [/facial|skin|derma|peel|laser|aesthetic/i, 'Skin & Aesthetic Wellness'],
      [/gym|strength|weights|conditioning|hiit|cardio|training/i, 'Fitness & Conditioning'],
      [/hike|surf|kayak|climb|adventure|excursion|bushwalk/i, 'Nature & Adventure Wellness'],
    ];

    for (const [pattern, category] of hints) {
      if (!pattern.test(clean)) continue;
      const id = catId.get(category);
      if (!id || out.some((o) => o.category === category)) continue;
      out.push({
        practiceId: null,
        name: phrase.trim(),
        category,
        categoryId: id as number,
        why: 'no practice matches, but the category is clear from the wording',
        confidence: 'Category only',
      });
    }
  }

  const rank = { Exact: 0, Close: 1, 'Category only': 2 };
  return out.sort((a, b) => rank[a.confidence] - rank[b.confidence]).slice(0, 6);
}

/** Adds a practice from wherever somebody is working, rather than making
 *  them leave and come back. */
export async function createPractice(
  name: string, categoryId: number, flagSlugs?: string[]
): Promise<Result & { practiceId?: number; practiceName?: string; categoryName?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'A name is needed.' };
  if (!categoryId) return { ok: false, error: 'Choose a category.' };

  const supabase = await createClient();

  const slug = trimmed.toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);

  const { data: practice, error } = await supabase.from('modality_practices').insert({
    category_id: categoryId,
    name: trimmed,
    slug,
    synonyms: [trimmed.toLowerCase()],
  }).select('id,name,modality_categories(name)').single();

  if (error) {
    if (/duplicate/i.test(error.message)) {
      const { data: existing } = await supabase.from('modality_practices')
        .select('id,name,modality_categories(name)').eq('slug', slug).maybeSingle();
      return existing
        ? { ok: true, practiceId: existing.id, practiceName: existing.name,
            categoryName: (existing as any).modality_categories?.name,
            message: 'That practice already existed — using it.' }
        : { ok: false, error: error.message };
    }
    return { ok: false, error: error.message };
  }

  if (flagSlugs?.length) {
    const { data: types } = await supabase
      .from('practice_flag_types').select('id').in('slug', flagSlugs);
    if (types?.length) {
      await supabase.from('practice_flags').insert(
        types.map((t: any) => ({ practice_id: practice.id, flag_type_id: t.id })));
    }
  }

  revalidatePath('/settings/catalogues/practices');
  return {
    ok: true,
    practiceId: practice.id,
    practiceName: practice.name,
    categoryName: (practice as any).modality_categories?.name,
    message: `${trimmed} added to the taxonomy.`,
  };
}

/** Adds a category, from wherever somebody is standing.
 *
 *  Categories are structural and rarely added — 18 exist and a
 *  nineteenth is a real decision. But sending somebody to Settings
 *  mid-review loses their place, and the alternative is that a practice
 *  gets filed under a category it does not belong to because that was
 *  easier than leaving.
 */
export async function createCategory(
  name: string, container: 'wellness' | 'retreat' | 'both' = 'both'
): Promise<Result & { id?: number }> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'It needs a name.' };

  const supabase = await createClient();

  const slug = clean.toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);

  const { data: last } = await supabase.from('modality_categories')
    .select('display_order').order('display_order', { ascending: false })
    .limit(1).maybeSingle();

  const { data, error } = await supabase.from('modality_categories').insert({
    name: clean,
    slug,
    display_order: (last?.display_order ?? 0) + 10,
    in_wellness: container !== 'retreat',
    in_retreat: container !== 'wellness',
    is_published: false,
  }).select('id').single();

  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'A category with that name exists.' : error.message };
  }

  revalidatePath('/settings/catalogues/practices');
  revalidatePath('/settings/catalogues/candidates');
  return { ok: true, id: data.id, message: `${clean} added.` };
}
