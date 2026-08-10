'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; id?: number } | { ok: false; error: string };

const CONTACT_COLUMNS = new Set([
  'entity_type','first_name','surname','organisation','email','phone','whatsapp',
  'website_url','country_id','city_id','preferred_contact_method','language',
  'source','activecampaign_id','status','notes',
]);

function humanise(m: string) {
  if (/duplicate key/i.test(m) && /email/i.test(m))
    return 'A contact with that email address already exists.';
  if (/duplicate key/i.test(m)) return 'That value must be unique and is already in use.';
  if (/violates foreign key/i.test(m)) return 'That reference does not exist.';
  if (/violates check constraint/i.test(m)) return 'Not one of the permitted values.';
  return m;
}

export async function saveContactField(
  contactId: number, column: string, value: unknown
): Promise<Result> {
  if (!CONTACT_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not an editable contact column.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('contacts').update({ [column]: value }).eq('id', contactId);
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true };
}

export async function createContact(formData: FormData) {
  const first = String(formData.get('first_name') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();
  const org = String(formData.get('organisation') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!first && !surname && !org) return { error: 'A name or organisation is required.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      first_name: first || null,
      surname: surname || null,
      organisation: org || null,
      email: email || null,
      entity_type: !first && !surname && org ? 'Organisation' : 'Person',
    })
    .select('id').single();

  if (error) return { error: humanise(error.message) };
  redirect(`/contacts/${data.id}`);
}

export async function setContactRole(
  contactId: number, roleId: number, grant: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = grant
    ? await supabase.from('contact_roles').upsert(
        { contact_id: contactId, role_id: roleId }, { onConflict: 'contact_id,role_id' })
    : await supabase.from('contact_roles')
        .delete().eq('contact_id', contactId).eq('role_id', roleId);

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/contacts/${contactId}`);
  return { ok: true };
}

export async function setContactTag(
  contactId: number, tagId: number, apply: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = apply
    ? await supabase.from('contact_tag_assignments').upsert(
        { contact_id: contactId, tag_id: tagId }, { onConflict: 'contact_id,tag_id' })
    : await supabase.from('contact_tag_assignments')
        .delete().eq('contact_id', contactId).eq('tag_id', tagId);

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/contacts/${contactId}`);
  return { ok: true };
}

export async function deleteContact(contactId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('contacts').delete().eq('id', contactId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/contacts');
  return { ok: true };
}
