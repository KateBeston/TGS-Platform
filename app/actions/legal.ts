'use server';

import { revalidatePath } from 'next/cache';
import { detectFormat, isArchive } from '@/lib/fileTypes';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

const DOC_COLUMNS = new Set([
  'name','slug','document_type','category','summary','requires_acceptance',
  'meta_title','meta_description','is_published','display_order',
  'jurisdiction','owner_note','review_due','reviewed_by','reviewed_at','used_on',
  'doc_status','sensitivity','needs_attention',
]);

const VERSION_COLUMNS = new Set([
  'version_label','body','effective_from','effective_to','is_current',
  'change_summary','approved_by','approved_at',
  // Which period this wording is for. The interim concierge phase and
  // the subscription phase carry genuinely different terms, so the same
  // document has two current versions and the site serves whichever
  // applies.
  'applies_during',
]);

function humanise(m: string) {
  if (/duplicate key.*slug/i.test(m)) return 'That slug is already in use.';
  if (/protect_published_slug|slug.*published/i.test(m))
    return 'The slug cannot change while the document is published — unpublish it first.';
  return m;
}

export async function saveLegalDocument(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!DOC_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a legal document.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('legal_documents')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/legal');
  revalidatePath(`/legal/${id}`);
  return { ok: true };
}

export async function createLegalDocument(
  name: string, type: string, category: string
): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'A name is required.' };

  const slug = trimmed.toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

  const supabase = await createClient();
  const { count } = await supabase
    .from('legal_documents').select('*', { count: 'exact', head: true });

  const { data, error } = await supabase.from('legal_documents').insert({
    name: trimmed, slug, document_type: type, category,
    requires_acceptance: type !== 'Public',
    display_order: (count ?? 0) + 1,
  }).select('id').single();

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/legal');
  return { ok: true, id: data.id };
}

/* ── versions ────────────────────────────────────────────────────── */

/** A new version never edits the old one.
 *
 *  When a document is revised, anyone who accepted the previous wording
 *  remains bound by that wording — and has to be able to be shown it. So
 *  the old version keeps its text and gains an end date; it is never
 *  overwritten. */
export async function createVersion(
  documentId: number, label: string, effectiveFrom: string,
  appliesDuring: string = 'Both'
): Promise<Result> {
  const supabase = await createClient();

  // The current version for the same phase, so a revision to the interim
  // wording starts from the interim wording rather than from whichever
  // version happened to be found first.
  const { data: current } = await supabase
    .from('legal_document_versions')
    .select('id,body').eq('legal_document_id', documentId)
    .eq('is_current', true).eq('applies_during', appliesDuring).maybeSingle();

  const { data, error } = await supabase.from('legal_document_versions').insert({
    legal_document_id: documentId,
    version_label: label.trim() || null,
    effective_from: effectiveFrom || new Date().toISOString().slice(0, 10),
    applies_during: appliesDuring,
    // Carried forward so a revision starts from the current wording rather
    // than a blank page — the change is usually a paragraph, not a rewrite.
    body: current?.body ?? null,
    is_current: false,
  }).select('id').single();

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/legal/${documentId}`);
  return { ok: true, id: data.id };
}

export async function saveVersion(
  versionId: number, documentId: number, column: string, value: unknown
): Promise<Result> {
  if (!VERSION_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a version.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('legal_document_versions')
    .update({ [column]: value }).eq('id', versionId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/legal/${documentId}`);
  return { ok: true };
}

/** Making a version current closes the previous one rather than deleting
 *  it, so the record of what was in force on any given date survives. */
export async function makeCurrent(versionId: number, documentId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: version } = await supabase
    .from('legal_document_versions').select('effective_from, applies_during')
    .eq('id', versionId).single();

  const dayBefore = version?.effective_from
    ? new Date(new Date(version.effective_from).getTime() - 86_400_000)
        .toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Only the version it actually replaces — the current one for the same
  // phase. Interim and subscription wording are both in force for
  // different periods, and retiring one because the other was put live
  // would leave the site serving terms that do not apply.
  await supabase.from('legal_document_versions')
    .update({ is_current: false, effective_to: dayBefore })
    .eq('legal_document_id', documentId)
    .eq('is_current', true)
    .eq('applies_during', version?.applies_during ?? 'Both');

  const { error } = await supabase.from('legal_document_versions')
    .update({ is_current: true, effective_to: null }).eq('id', versionId);

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/legal/${documentId}`);
  return { ok: true, message: 'This version is now in force.' };
}

/* ── files ───────────────────────────────────────────────────────── */

export async function uploadLegalFile(formData: FormData): Promise<Result> {
  const documentId = Number(formData.get('legal_document_id'));
  const kind = String(formData.get('file_kind') ?? 'Reference');
  const file = formData.get('file') as File | null;
  if (!documentId || !file || !file.size) return { ok: false, error: 'No file received.' };

  const supabase = await createClient();
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  const safe = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60);
  const path = `${documentId}/${Date.now()}-${safe}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('legal').upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    if (/exceeded the maximum/i.test(upErr.message)) {
      return { ok: false, error: 'That file is over the 25 MB limit.' };
    }
    if (/mime type/i.test(upErr.message)) {
      return { ok: false, error: 'Accepted types are PDF, Word, JPEG and PNG.' };
    }
    return { ok: false, error: upErr.message };
  }

  const format = detectFormat(file.name, file.type);

  const { error } = await supabase.from('legal_files').insert({
    legal_document_id: documentId,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type,
    file_size_bytes: file.size,
    file_kind: kind,
    file_format: format?.key ?? null,
    // An archive cannot be previewed or searched, so a note describing
    // what is inside is the difference between a file and a mystery.
    archive_contents: isArchive(file.name, file.type)
      ? 'Not described — say what is inside so it can be found later' : null,
  });

  if (error) {
    await supabase.storage.from('legal').remove([path]);
    return { ok: false, error: error.message };
  }

  revalidatePath(`/legal/${documentId}`);
  return {
    ok: true,
    message: isArchive(file.name, file.type)
      ? `${file.name} uploaded. Describe what is inside it — an archive cannot be searched.`
      : `${file.name} uploaded.`,
  };
}

export async function saveLegalFile(
  fileId: number, documentId: number, column: string, value: unknown
): Promise<Result> {
  const allowed = new Set(['file_kind','signed_by','signed_at','counterparty',
                           'expires_at','notes','external_url','archive_contents']);
  if (!allowed.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('legal_files')
    .update({ [column]: value }).eq('id', fileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/legal/${documentId}`);
  return { ok: true };
}

export async function deleteLegalFile(fileId: number, documentId: number): Promise<Result> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('legal_files').select('storage_path').eq('id', fileId).single();
  const { error } = await supabase.from('legal_files').delete().eq('id', fileId);
  if (error) return { ok: false, error: error.message };
  if (row?.storage_path) await supabase.storage.from('legal').remove([row.storage_path]);
  revalidatePath(`/legal/${documentId}`);
  return { ok: true };
}

export async function addFileByUrl(
  documentId: number, url: string, name: string, kind: string
): Promise<Result> {
  if (!/^https?:\/\//i.test(url.trim())) return { ok: false, error: 'That is not a usable URL.' };
  const supabase = await createClient();
  const { error } = await supabase.from('legal_files').insert({
    legal_document_id: documentId,
    file_name: name.trim() || url,
    external_url: url.trim(),
    file_kind: kind,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/legal/${documentId}`);
  return { ok: true };
}

/* ── batch upload ────────────────────────────────────────────────── */

export type FileMatch = {
  fileName: string;
  documentId: number | null;
  documentName: string | null;
  slug: string | null;
  confidence: 'Exact' | 'Strong' | 'Possible' | 'None';
  reason: string;
  alternatives: { id: number; name: string; score: number }[];
};

/** Normalises a filename or a document name to the same shape, so the two
 *  can be compared. Strips the TGS prefix, the extension, the "(1)" that
 *  a second download adds, and any version suffix. */
function normaliseName(s: string): string {
  return s
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^TGS[_\s-]*/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/[_\s-]*[Vv]\d+(\.\d+)?$/, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Words that appear in nearly every legal document name and therefore
 *  say nothing about which one this is. Matching on them would pair the
 *  Refund Policy with the Cookie Policy. */
const NOISE = new Set(['policy', 'agreement', 'terms', 'and', 'the', 'of',
  'statement', 'form', 'reference', 'declaration', 'conditions', 'tgs']);

function score(fileWords: string[], docWords: string[]): number {
  const meaningful = (w: string[]) => w.filter((x) => !NOISE.has(x) && x.length > 2);
  const f = new Set(meaningful(fileWords));
  const d = new Set(meaningful(docWords));
  if (!f.size || !d.size) return 0;

  let shared = 0;
  for (const w of f) if (d.has(w)) shared++;
  // Proportion of the smaller set matched, so a short name is not
  // penalised for being short.
  return shared / Math.min(f.size, d.size);
}

/** Matches filenames to documents, and says how confident it is.
 *
 *  Nothing is attached on the strength of this — the matches are shown
 *  and confirmed first. A misfiled legal document is worse than an
 *  unfiled one, because it looks filed. */
export async function matchFilesToDocuments(fileNames: string[]): Promise<FileMatch[]> {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from('legal_documents').select('id,name,slug').order('name');

  return fileNames.map((fileName) => {
    const norm = normaliseName(fileName);
    const fileWords = norm.split(' ');

    const scored = (docs ?? []).map((d: any) => {
      const docNorm = normaliseName(d.name);
      const slugNorm = d.slug.replace(/-/g, ' ');

      // An exact match on either the name or the slug is unambiguous.
      if (norm === docNorm || norm === slugNorm) {
        return { id: d.id, name: d.name, slug: d.slug, score: 1, exact: true };
      }
      const s = Math.max(
        score(fileWords, docNorm.split(' ')),
        score(fileWords, slugNorm.split(' ')),
      );
      return { id: d.id, name: d.name, slug: d.slug, score: s, exact: false };
    }).sort((a, b) =>
      // An exact match must sort above a word-overlap match of the same
      // score. "Venue Owner Agreement" and "Venue Owner Subscription
      // Terms" both score 1 on the words "venue owner" — because
      // "agreement" and "terms" are noise — so without this the tie broke
      // alphabetically and the wrong one won.
      (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || b.score - a.score);

    const best = scored[0];
    const runnerUp = scored[1];

    if (!best || best.score < 0.34) {
      return {
        fileName, documentId: null, documentName: null, slug: null,
        confidence: 'None' as const,
        reason: 'No document name resembles this filename.',
        alternatives: scored.slice(0, 4).map((s) => ({ id: s.id, name: s.name, score: s.score })),
      };
    }

    // A clear winner is trustworthy; two close candidates are not, however
    // high the score.
    const margin = best.score - (runnerUp?.score ?? 0);
    const confidence = best.exact ? 'Exact'
      : best.score >= 0.75 && margin >= 0.2 ? 'Strong'
      : 'Possible';

    return {
      fileName,
      documentId: best.id,
      documentName: best.name,
      slug: best.slug,
      confidence: confidence as FileMatch['confidence'],
      reason: best.exact
        ? 'The filename matches the document name exactly.'
        : confidence === 'Strong'
          ? `Matches on the distinctive words, and nothing else comes close.`
          : `Closest match, but ${runnerUp?.name ?? 'another document'} is not far behind — check this one.`,
      alternatives: scored.slice(1, 5).map((s) => ({ id: s.id, name: s.name, score: s.score })),
    };
  });
}

/** Uploads one file against a confirmed document. Called once per file by
 *  the batch screen so each result is reported separately — a single
 *  failure should not lose the other thirty. */
export async function uploadMatchedFile(formData: FormData): Promise<Result> {
  const documentId = Number(formData.get('legal_document_id'));
  const kind = String(formData.get('file_kind') ?? 'Published PDF');
  const file = formData.get('file') as File | null;
  if (!documentId || !file || !file.size) {
    return { ok: false, error: 'No file received.' };
  }

  const supabase = await createClient();

  // A file already attached to this document under the same name is not
  // uploaded twice — running the batch again should be safe.
  const { data: existing } = await supabase
    .from('legal_files').select('id')
    .eq('legal_document_id', documentId).eq('file_name', file.name).maybeSingle();
  if (existing) {
    return { ok: true, message: `${file.name} is already attached.` };
  }

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  const safe = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60);
  const path = `${documentId}/${Date.now()}-${safe}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('legal').upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    if (/exceeded the maximum/i.test(upErr.message)) {
      return { ok: false, error: `${file.name} is over the 25 MB limit.` };
    }
    if (/mime type/i.test(upErr.message)) {
      return { ok: false, error: `${file.name} — accepted types are PDF, Word, JPEG and PNG.` };
    }
    return { ok: false, error: `${file.name} — ${upErr.message}` };
  }

  const format = detectFormat(file.name, file.type);

  const { error } = await supabase.from('legal_files').insert({
    legal_document_id: documentId,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type,
    file_size_bytes: file.size,
    file_kind: kind,
    file_format: format?.key ?? null,
    archive_contents: isArchive(file.name, file.type)
      ? 'Not described — say what is inside so it can be found later' : null,
  });

  if (error) {
    await supabase.storage.from('legal').remove([path]);
    return { ok: false, error: `${file.name} — ${error.message}` };
  }

  revalidatePath('/legal');
  revalidatePath(`/legal/${documentId}`);
  return { ok: true };
}

export async function legalDocumentList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('legal_documents').select('id,name,category').order('category').order('name');
  return data ?? [];
}

/* ── change log ──────────────────────────────────────────────────── */

const LOG_COLUMNS = new Set(['reason', 'prompted_by', 'reference', 'summary']);

/** The reason a change was made, written after the fact.
 *
 *  What changed is captured automatically because nobody records it
 *  reliably by hand. Why it changed cannot be inferred by anything, and it
 *  is the part an audit actually asks about — "your retention period
 *  changed from seven years to five in March, on what basis?" is only
 *  answerable if somebody wrote the answer down. */
export async function explainChange(
  logId: number, documentId: number, column: string, value: unknown
): Promise<Result> {
  if (!LOG_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a log entry.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('legal_change_log')
    .update({ [column]: value }).eq('id', logId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/legal/${documentId}`);
  revalidatePath('/legal/changes');
  return { ok: true };
}

/** A note recorded against a document without editing anything — advice
 *  received, a question raised, a decision taken not to change something.
 *  A decision not to act is as worth recording as a decision to act. */
export async function addChangeNote(
  documentId: number, summary: string, reason: string, promptedBy: string
): Promise<Result> {
  if (!summary.trim()) return { ok: false, error: 'Describe what happened.' };
  const supabase = await createClient();
  const { error } = await supabase.from('legal_change_log').insert({
    legal_document_id: documentId,
    change_type: 'Reviewed',
    summary: summary.trim(),
    reason: reason.trim() || null,
    prompted_by: promptedBy.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/legal/${documentId}`);
  return { ok: true, message: 'Recorded.' };
}

/* ── access logging ──────────────────────────────────────────────── */

/** Records that a file was opened, and returns a short-lived signed URL.
 *
 *  Legal files are the case where "who has seen this" is usually the
 *  question — the signed agreement, the solicitor's advice. Without this
 *  the portal can say a file exists but not that anybody looked at it.
 *
 *  The URL lasts five minutes rather than an hour. A signed URL is a
 *  bearer token: anyone holding it has the file, log or no log, so the
 *  shorter it lives the smaller that window is. */
export async function openLegalFile(
  fileId: number
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: file } = await supabase
    .from('legal_files')
    .select('*, legal_documents(id,name,sensitivity)')
    .eq('id', fileId).single();

  if (!file) return { ok: false, error: 'File not found.' };
  if (!file.storage_path) {
    return file.external_url
      ? { ok: true, url: file.external_url }
      : { ok: false, error: 'This record has no file attached.' };
  }

  const { data: signed, error } = await supabase.storage
    .from('legal').createSignedUrl(file.storage_path, 300);

  if (error || !signed?.signedUrl) {
    return { ok: false, error: error?.message ?? 'Could not open the file.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: appUser } = user
    ? await supabase.from('app_users')
        .select('id,email').eq('auth_user_id', user.id).maybeSingle()
    : { data: null };

  // Name and document are stored as text as well, so the record still
  // means something after the file is deleted.
  await supabase.from('legal_file_access').insert({
    legal_file_id: file.id,
    legal_document_id: file.legal_document_id,
    file_name: file.file_name,
    document_name: (file as any).legal_documents?.name ?? null,
    accessed_by: appUser?.email ?? user?.email ?? 'Unknown',
    accessed_by_id: appUser?.id ?? null,
    access_type: 'Download',
  });

  return { ok: true, url: signed.signedUrl };
}

export async function setSensitivity(
  documentId: number, level: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('legal_documents')
    .update({ sensitivity: level }).eq('id', documentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/legal/${documentId}`);
  revalidatePath('/legal');
  return { ok: true };
}

export async function fileAccessLog(documentId?: number) {
  const supabase = await createClient();
  let q = supabase.from('legal_file_access').select('*')
    .order('accessed_at', { ascending: false }).limit(200);
  if (documentId) q = q.eq('legal_document_id', documentId);
  const { data } = await q;
  return data ?? [];
}
