'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CATALOGUE_TABLES } from '@/lib/catalogueSchema';

export type SaveResult = { ok: true; id?: number } | { ok: false; error: string };

function humanise(message: string): string {
  if (/slug/i.test(message) && /publish/i.test(message)) {
    return 'Slug is locked while this record is published. Unpublish first if the change is intended.';
  }
  if (/duplicate key/i.test(message)) return 'That name or slug is already in use.';
  if (/violates foreign key/i.test(message)) return 'Still referenced by other records — cannot be removed.';
  if (/violates check constraint/i.test(message)) return 'Not one of the permitted values.';
  return message;
}

export async function saveCatalogueField(
  table: string, rowId: number, column: string, value: unknown
): Promise<SaveResult> {
  const def = CATALOGUE_TABLES[table];
  if (!def) return { ok: false, error: `"${table}" is not an editable catalogue.` };
  if (!def.cols.has(column) && column !== def.parentCol) {
    return { ok: false, error: `"${column}" is not editable on ${table}.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ [column]: value }).eq('id', rowId);
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true };
}

export async function addCatalogueRow(table: string, name: string): Promise<SaveResult> {
  if (!CATALOGUE_TABLES[table]) return { ok: false, error: `"${table}" is not an editable catalogue.` };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'A name is required.' };

  const slug = trimmed.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table).insert({ name: trimmed, slug }).select('id').single();

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/settings', 'layout');
  return { ok: true, id: data?.id };
}

export async function deleteCatalogueRow(table: string, rowId: number): Promise<SaveResult> {
  if (!CATALOGUE_TABLES[table]) return { ok: false, error: `"${table}" is not an editable catalogue.` };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq('id', rowId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/settings', 'layout');
  return { ok: true };
}

/* ── organisation settings: key/value on tgs_settings ──────────────── */

export async function saveSetting(id: number, value: string | null): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('tgs_settings').update({ setting_value: value }).eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true };
}
